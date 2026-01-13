// screens/PropertyDetailsScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import {
  fetchFinancesByProperty,
  calculateOverview,
  fetchTenantBillingSummary,
} from '../lib/financesService';
import { fetchActiveContractByProperty } from '../lib/contractsService';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { optimizeImage, base64ToArrayBuffer, IMAGE_PICKER_OPTIONS } from '../lib/imageUtils';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { canViewPropertyDetails, getUserSubscription, getActivePropertiesCount, getRequiredPlan } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { getCache, setCache, removeCache, CACHE_KEYS, CACHE_TTL } from '../lib/cacheService';
import { PropertyDetailsSkeleton } from '../components/SkeletonLoader';

const PropertyDetailsScreen = ({ route, navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { property: initialProperty } = route.params;

  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [financesSummary, setFinancesSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    net: 0,
  });
  const [contract, setContract] = useState(null);
  const [billingSummary, setBillingSummary] = useState({
    expected: 0,
    paid: 0,
    overdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [financesLoading, setFinancesLoading] = useState(false);
  const isFocused = useIsFocused();
  const hasLoadedOnce = useRef(false);

  // Carregar dados dinâmicos (finanças) em lazy load
  const loadDynamicData = async () => {
    if (!initialProperty?.id) return;

    setFinancesLoading(true);

    // Buscar resumo financeiro desta propriedade (lazy load)
    const { data: financesData, error: financesError } = await fetchFinancesByProperty(
      initialProperty.id,
      { limit: 5 },
    );

    if (!financesError && financesData) {
      const overview = calculateOverview(financesData);
      setFinancesSummary({
        totalIncome: overview.totalIncome,
        totalExpenses: overview.totalExpenses,
        net: overview.netProfit,
      });
    }

    setFinancesLoading(false);
  };

  // Carregar dados principais da propriedade
  const loadPropertyData = async () => {
    if (!initialProperty?.id) return;

    // Query otimizada - buscar apenas campos necessários
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('id, address, street, number, neighborhood, city, state, cep, complement, type, bedrooms, bathrooms, total_rooms, sqft, rent, image_urls, created_at')
      .eq('id', initialProperty.id)
      .single();

    if (propertyError) {
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível buscar os detalhes da propriedade.');
      console.error('Error fetching property:', propertyError);
      return;
    }

    if (propertyData) {
      setProperty(propertyData);
    }

    // Buscar inquilino e contrato em paralelo
    const [tenantResult, contractResult] = await Promise.allSettled([
      supabase
        .from('tenants')
        .select('id, full_name, phone, property_id')
        .eq('property_id', initialProperty.id)
        .maybeSingle(),
      fetchActiveContractByProperty(initialProperty.id),
    ]);

    let tenantData = null;
    if (tenantResult.status === 'fulfilled') {
      const { data, error } = tenantResult.value;
      if (!error && data) {
        tenantData = data;
        setTenant(data);
      }
    }

    let activeContract = null;
    if (contractResult.status === 'fulfilled' && contractResult.value.data) {
      activeContract = contractResult.value.data;
      setContract(activeContract);

      // Calcular billing summary apenas se houver contrato
      const source = {
        property_id: activeContract.property_id,
        tenant_id: activeContract.tenant_id,
        start_date: activeContract.start_date,
        due_date: activeContract.due_day,
        lease_term: activeContract.lease_term,
      };

      const { summary } = await fetchTenantBillingSummary(source);
      setBillingSummary(summary);

      // Cachear dados principais
      const cacheKey = CACHE_KEYS.PROPERTY_DETAILS(initialProperty.id);
      await setCache(cacheKey, {
        property: propertyData,
        tenant: tenantData,
        contract: activeContract,
        billingSummary: summary,
      }, CACHE_TTL.DEFAULT);
    } else {
      setContract(null);
      setBillingSummary({ expected: 0, paid: 0, overdue: 0 });
    }

    setLoading(false);

    // Carregar dados dinâmicos (finanças) após dados principais
    loadDynamicData();
  };

  // Carregar dados iniciais (apenas uma vez)
  useEffect(() => {
    const loadInitialData = async () => {
      if (!initialProperty?.id || hasLoadedOnce.current) return;

      setLoading(true);

      // Verificar se a propriedade está bloqueada
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const canView = await canViewPropertyDetails(user.id, initialProperty.id);
        if (!canView) {
          setIsBlocked(true);
          const propertyCount = await getActivePropertiesCount(user.id);
          const subscription = await getUserSubscription(user.id);
          const currentPlan = subscription?.subscription_plan || 'free';
          const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(propertyCount);

          setSubscriptionInfo({
            currentPlan,
            propertyCount,
            requiredPlan,
          });
          setLoading(false);
          return;
        }
        setIsBlocked(false);
      }

      // Tentar buscar do cache primeiro
      const cacheKey = CACHE_KEYS.PROPERTY_DETAILS(initialProperty.id);
      const cachedData = await getCache(cacheKey);

      if (cachedData?.property) {
        setProperty(cachedData.property);
        setTenant(cachedData.tenant || null);
        setContract(cachedData.contract || null);
        setBillingSummary(cachedData.billingSummary || { expected: 0, paid: 0, overdue: 0 });
        setFinancesSummary(cachedData.financesSummary || { totalIncome: 0, totalExpenses: 0, net: 0 });
        setLoading(false);
        hasLoadedOnce.current = true;

        // Carregar dados dinâmicos em background
        loadDynamicData();
        return;
      }

      // Buscar dados principais
      await loadPropertyData();
      hasLoadedOnce.current = true;
    };

    loadInitialData();
  }, [initialProperty?.id]);

  // Quando a tela é focada novamente, apenas verificar bloqueio e atualizar dados críticos
  useEffect(() => {
    if (!isFocused || !hasLoadedOnce.current || !initialProperty?.id) return;

    const refreshCriticalData = async () => {
      // Apenas verificar bloqueio e atualizar contrato/billing se necessário
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const canView = await canViewPropertyDetails(user.id, initialProperty.id);
        if (!canView) {
          setIsBlocked(true);
          return;
        }
        setIsBlocked(false);
      }

      // Atualizar contrato e billing (pode ter mudado)
      const { data: activeContract } = await fetchActiveContractByProperty(initialProperty.id);
      if (activeContract) {
        setContract(activeContract);
        const source = {
          property_id: activeContract.property_id,
          tenant_id: activeContract.tenant_id,
          start_date: activeContract.start_date,
          due_date: activeContract.due_day,
          lease_term: activeContract.lease_term,
        };
        const { summary } = await fetchTenantBillingSummary(source);
        setBillingSummary(summary);
      }
    };

    refreshCriticalData();
  }, [isFocused, initialProperty?.id]);

  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar exclusão",
      "Deseja realmente excluir este imóvel? Isso irá remover o imóvel, os contratos associados e os lançamentos financeiros ligados a ele. Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          onPress: async () => {
            setIsDeleting(true);

            // 1) Desvincular o(s) inquilino(s) deste imóvel
            const { error: tenantError } = await supabase
              .from('tenants')
              .update({ property_id: null }) // <-- Ação: ATUALIZAR para nulo
              .eq('property_id', property.id);

            if (tenantError) {
              Alert.alert('Erro', 'Não foi possível desvincular o inquilino.');
              setIsDeleting(false);
              return;
            }

            // 2) Remover imagens do Storage (se houver)
            if (property.image_urls && property.image_urls.length > 0) {
              const bucketName = 'property-images';
              const filePaths = property.image_urls.map(url => url.split(`${bucketName}/`)[1]).filter(Boolean);
              if (filePaths.length > 0) {
                await supabase.storage.from(bucketName).remove(filePaths);
              }
            }

            // 3) Remover lançamentos financeiros ligados a este imóvel
            const { error: financesError } = await supabase
              .from('finances')
              .delete()
              .eq('property_id', property.id);

            if (financesError) {
              console.error('Erro ao remover lançamentos financeiros da propriedade:', financesError);
              Alert.alert(
                'Erro',
                `Não foi possível remover os lançamentos financeiros desta propriedade.\n\nDetalhes: ${financesError.message || 'verifique as regras do Supabase.'}`
              );
              setIsDeleting(false);
              return;
            }

            // 4) Remover contratos ligados a este imóvel
            const { error: contractsError } = await supabase
              .from('contracts')
              .delete()
              .eq('property_id', property.id);

            if (contractsError) {
              console.error('Erro ao remover contratos da propriedade:', contractsError);
              Alert.alert(
                'Erro',
                `Não foi possível remover os contratos desta propriedade.\n\nDetalhes: ${contractsError.message || 'verifique as regras do Supabase.'}`
              );
              setIsDeleting(false);
              return;
            }

            // 5) Finalmente, excluir o imóvel
            const { error: deleteError } = await supabase
              .from('properties')
              .delete()
              .eq('id', property.id);

            if (deleteError) {
              console.error('Erro ao excluir propriedade:', deleteError);
              Alert.alert(
                'Erro',
                `Não foi possível excluir a propriedade.\n\nDetalhes: ${deleteError.message || 'verifique as regras do Supabase.'}`
              );
            } else {
              // Invalidar cache
              await Promise.all([
                removeCache(CACHE_KEYS.PROPERTIES),
                removeCache(CACHE_KEYS.PROPERTY_DETAILS(property.id)),
              ]);

              Alert.alert('Sucesso', 'Propriedade excluída com sucesso.');
              navigation.goBack();
            }
            setIsDeleting(false);
          },
          style: 'destructive'
        }
      ]
    );
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
  };

  const handleAddImage = async () => {
    if (!property) return;

    if (property.image_urls && property.image_urls.length >= 10) {
      Alert.alert('Limite de fotos', 'Você pode adicionar no máximo 10 fotos por imóvel.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Você precisa permitir o acesso para adicionar fotos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);
        const asset = result.assets[0];

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Erro', 'Usuário não autenticado.');
          setIsUploadingImage(false);
          return;
        }

        const fileName = `${user.id}/${property.id}/${Date.now()}.jpg`;
        const bucketName = 'property-images';

        // Otimizar imagem antes do upload
        let arrayBuffer = null;
        if (asset.base64) {
          arrayBuffer = base64ToArrayBuffer(asset.base64);
        } else if (asset.uri) {
          const optimized = await optimizeImage(asset.uri);
          if (optimized.base64) {
            arrayBuffer = base64ToArrayBuffer(optimized.base64);
          }
        }

        if (!arrayBuffer) {
          Alert.alert('Erro', 'Não foi possível processar a imagem.');
          setIsUploadingImage(false);
          return;
        }

        // Fazer upload para o Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          Alert.alert('Erro', 'Não foi possível fazer upload da imagem.');
          setIsUploadingImage(false);
          return;
        }

        // Obter URL pública da imagem
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        const newImageUrl = urlData.publicUrl;

        // Atualizar a propriedade com a nova URL
        const currentImageUrls = property.image_urls || [];
        const updatedImageUrls = [...currentImageUrls, newImageUrl];

        const { error: updateError } = await supabase
          .from('properties')
          .update({ image_urls: updatedImageUrls })
          .eq('id', property.id);

        if (updateError) {
          console.error('Erro ao atualizar propriedade:', updateError);
          Alert.alert('Erro', 'Não foi possível adicionar a foto.');
          // Tentar remover a imagem do storage se falhar
          await supabase.storage.from(bucketName).remove([fileName]);
        } else {
          // Invalidar cache
          await removeCache(CACHE_KEYS.PROPERTY_DETAILS(property.id));
          await removeCache(CACHE_KEYS.PROPERTIES);

          // Atualizar o estado local
          setProperty({ ...property, image_urls: updatedImageUrls });
          Alert.alert('Sucesso', 'Foto adicionada com sucesso!');
        }

        setIsUploadingImage(false);
      }
    } catch (error) {
      console.error('Erro ao adicionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a foto.');
      setIsUploadingImage(false);
    }
  };

  const formatCurrency = (value) => {
    return `R$${Number(value || 0).toFixed(2)}`;
  };

  const formatDate = (raw) => {
    if (!raw) return 'Sem data';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return 'Sem data';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleEndTenancy = () => {
    if (!tenant?.id) return;

    Alert.alert(
      'Encerrar locação',
      'Tem certeza que deseja encerrar a locação deste inquilino para este imóvel?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('tenants')
              .update({ property_id: null })
              .eq('id', tenant.id);

            if (error) {
              console.error('Erro ao encerrar locação:', error);
              Alert.alert('Erro', 'Não foi possível encerrar a locação.');
              return;
            }

            Alert.alert('Sucesso', 'Locação encerrada e inquilino desvinculado.');
            setTenant(null);
          },
        },
      ]
    );
  };

  const getPaymentStatus = () => {
    if (!contract) return '-';

    const { expected, paid, overdue } = billingSummary;

    if (overdue > 0) return 'Vencido';
    if (expected > paid) return 'Aguardando pagamento';
    if (expected > 0 && expected === paid) return 'Pago';

    return '-';
  };

  if (loading || !property) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.header}>Carregando...</Text>
        </View>
        <ScrollView style={styles.scrollContainer}>
          <PropertyDetailsSkeleton />
        </ScrollView>
      </View>
    );
  }

  // Tela de bloqueio quando propriedade está bloqueada
  if (isBlocked) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.header} numberOfLines={1} ellipsizeMode="tail">
            {property.street
              ? `${property.street}${property.number ? `, ${property.number}` : ''}`
              : property.address}
          </Text>
        </View>
        <View style={styles.blockedContainer}>
          <MaterialIcons name="lock" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.blockedTitle}>Acesso Bloqueado</Text>
          <Text style={styles.blockedMessage}>
            Esta propriedade requer upgrade de plano para ser acessada.
          </Text>
          <Text style={styles.blockedSubMessage}>
            Você está usando {subscriptionInfo?.propertyCount || 0} {subscriptionInfo?.propertyCount === 1 ? 'imóvel' : 'imóveis'}.
            Faça upgrade para acessar todos os seus imóveis.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButtonBlocked}
            onPress={() => setShowUpgradeModal(true)}
          >
            <Text style={styles.upgradeButtonTextBlocked}>Fazer Upgrade</Text>
          </TouchableOpacity>
        </View>

        <UpgradeModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            navigation.navigate('Subscription');
          }}
          currentPlan={subscriptionInfo?.currentPlan || 'free'}
          propertyCount={subscriptionInfo?.propertyCount || 0}
          requiredPlan={subscriptionInfo?.requiredPlan || 'basic'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={1} ellipsizeMode="tail">
          {property.street
            ? `${property.street}${property.number ? `, ${property.number}` : ''}`
            : property.address}
        </Text>
      </View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fotos do Imóvel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {property.image_urls && property.image_urls.length > 0 ? (
              <>
                {property.image_urls.map((url, index) => (
                  <TouchableOpacity key={index} onPress={() => openImageModal(url)}>
                    <Image
                      source={url}
                      style={styles.galleryImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handleAddImage}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <MaterialIcons name="add" size={32} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.noImageContainer}>
                  <Text style={styles.noImageText}>Nenhuma foto cadastrada</Text>
                </View>
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handleAddImage}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <MaterialIcons name="add" size={32} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço</Text>
          {property.street ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rua/Avenida</Text>
                <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                  {property.street}{property.number ? `, ${property.number}` : ''}
                </Text>
              </View>
              {property.complement && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Complemento</Text>
                  <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                    {property.complement}
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bairro</Text>
                <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                  {property.neighborhood || 'N/A'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cidade/Estado</Text>
                <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                  {property.city || 'N/A'}{property.state ? ` - ${property.state}` : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CEP</Text>
                <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                  {property.cep ? `${property.cep.slice(0, 5)}-${property.cep.slice(5)}` : 'N/A'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Endereço</Text>
              <Text style={styles.infoValue} numberOfLines={0} ellipsizeMode="tail">
                {property.address || 'N/A'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhes da Propriedade</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{property.type || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quartos</Text>
            <Text style={styles.infoValue}>{property.bedrooms || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Banheiros</Text>
            <Text style={styles.infoValue}>{property.bathrooms || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Área (m²)</Text>
            <Text style={styles.infoValue}>{property.sqft || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total de Cômodos</Text>
            <Text style={styles.infoValue}>{property.total_rooms || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.editButtonContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProperty', { property: property })}
          >
            <Text style={styles.editButtonText}>Editar Propriedade</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aluguel & Contrato</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Aluguel Mensal</Text>
            <Text style={styles.infoValue}>
              {contract?.rent_amount ? formatCurrency(contract.rent_amount) : formatCurrency(property.rent)}/mês
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{tenant ? 'Alugada' : 'Disponível'}</Text>
          </View>
          {contract ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Data de Início</Text>
                <Text style={styles.infoValue}>{formatDate(contract.start_date)}</Text>
              </View>
              {contract.end_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Data de Término</Text>
                  <Text style={styles.infoValue}>{formatDate(contract.end_date)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Duração do Contrato</Text>
                <Text style={styles.infoValue}>
                  {contract.lease_term != null ? `${contract.lease_term} meses` : 'N/A'}
                </Text>
              </View>
              {contract.due_day && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dia de Vencimento</Text>
                  <Text style={styles.infoValue}>Dia {contract.due_day}</Text>
                </View>
              )}
              {contract.deposit && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Depósito Caução</Text>
                  <Text style={styles.infoValue}>{formatCurrency(contract.deposit)}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contrato</Text>
              <Text style={styles.infoValue}>Nenhum contrato ativo</Text>
            </View>
          )}
          {contract && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status de pagamento</Text>
              <Text
                style={[
                  styles.infoValue,
                  billingSummary.overdue > 0 && { color: theme.colors.danger, fontWeight: '600' },
                ]}
              >
                {getPaymentStatus()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo Financeiro</Text>
          <View style={styles.financeRow}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Entradas</Text>
              <Text style={[styles.financeValue, styles.income]}>
                {formatCurrency(financesSummary.totalIncome)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Despesas</Text>
              <Text style={[styles.financeValue, styles.expense]}>
                {formatCurrency(financesSummary.totalExpenses)}
              </Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Saldo</Text>
              <Text
                style={[
                  styles.financeValue,
                  financesSummary.net >= 0 ? styles.income : styles.expense,
                ]}
              >
                {formatCurrency(financesSummary.net)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inquilino(s)</Text>
          {tenant ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('TenantDetails', { tenant })}
            >
              <View style={styles.tenantCard}>
                <View style={styles.tenantHeaderRow}>
                  <Text style={styles.tenantName}>{tenant.full_name}</Text>
                  <TouchableOpacity
                    style={styles.endTenancyButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEndTenancy();
                    }}
                  >
                    <MaterialIcons name="close" size={16} color={theme.colors.danger} />
                    <Text style={styles.endTenancyText}>Encerrar locação</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.tenantPhone}>{tenant.phone}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noTenantText}>Nenhum inquilino associado.</Text>
          )}
          <View style={styles.tenantActions}>
            <TouchableOpacity
              style={styles.tenantActionButton}
              onPress={() => navigation.navigate('LinkTenant', { propertyId: property.id })}
            >
              <Text style={styles.tenantActionText}>
                {tenant ? 'Trocar / editar inquilino' : 'Adicionar inquilino'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteProperty}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={[styles.buttonText, styles.deleteButtonText]}>Excluir Propriedade</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
            <MaterialIcons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Image
            source={selectedImage}
            style={styles.fullScreenImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    marginRight: 10,
  },
  header: {
    ...theme.typography.sectionTitle,
    flex: 1,
    color: theme.colors.textPrimary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 0,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: 10,
    color: theme.colors.textPrimary,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.md,
    marginRight: 10,
    backgroundColor: theme.colors.background,
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.md,
    marginRight: 10,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  noImageContainer: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    alignItems: 'flex-start',
  },
  infoLabel: {
    ...theme.typography.bodyStrong,
    minWidth: 120,
    maxWidth: 140,
    marginRight: 16,
    flexShrink: 0,
    color: theme.colors.textPrimary,
  },
  infoValue: {
    ...theme.typography.body,
    flex: 1,
    flexShrink: 1,
    color: theme.colors.textPrimary,
  },
  tenantCard: {
    backgroundColor: theme.colors.surfaceHighlight || '#f0f7ff',
    borderRadius: theme.radii.md,
    padding: 15,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  tenantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tenantName: {
    ...theme.typography.bodyStrong,
    marginBottom: 5,
    color: theme.colors.textPrimary,
  },
  tenantPhone: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
  },
  endTenancyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.dangerSoft || '#ffebee',
  },
  endTenancyText: {
    marginLeft: 4,
    ...theme.typography.caption,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  tenantActions: {
    marginTop: 10,
  },
  tenantActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
  },
  tenantActionText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  noTenantText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    paddingVertical: 10,
    fontStyle: 'italic',
    ...theme.typography.caption,
  },
  editButtonContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginTop: 0,
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  editButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: theme.radii.pill,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: theme.radii.pill,
    flex: 1,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 0,
  },
  secondaryButton: {
    backgroundColor: theme.colors.textSecondary,
    padding: 15,
    borderRadius: theme.radii.pill,
    flex: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    ...theme.typography.button,
    color: theme.colors.surface,
  },
  editButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  deleteButtonText: {
    color: theme.colors.expense,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  financeItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  financeLabel: {
    ...theme.typography.caption,
    marginBottom: 4,
    color: theme.colors.textSecondary,
  },
  financeValue: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
  },
  income: {
    color: theme.colors.success || '#4CAF50',
  },
  expense: {
    color: theme.colors.danger || '#F44336',
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  blockedTitle: {
    ...theme.typography.sectionTitle,
    marginTop: 20,
    marginBottom: 12,
    color: theme.colors.textPrimary,
  },
  blockedMessage: {
    ...theme.typography.body,
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.textPrimary,
  },
  blockedSubMessage: {
    ...theme.typography.caption,
    textAlign: 'center',
    marginBottom: 24,
    color: theme.colors.textSecondary,
  },
  upgradeButtonBlocked: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radii.pill,
  },
  upgradeButtonTextBlocked: {
    ...theme.typography.button,
    color: theme.colors.surface,
  },
});

export default PropertyDetailsScreen;