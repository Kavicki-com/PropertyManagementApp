// screens/PropertyDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  fetchFinancesByProperty,
  calculateOverview,
  fetchTenantBillingSummary,
} from '../lib/financesService';
import { fetchActiveContractByProperty } from '../lib/contractsService';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii, typography } from '../theme';

const PropertyDetailsScreen = ({ route, navigation }) => {
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
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchFullPropertyDetails = async () => {
      if (!initialProperty?.id) {
        Alert.alert("Erro", "ID da propriedade não encontrado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
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

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, full_name, phone, property_id')
        .eq('property_id', initialProperty.id)
        .single();

      if (tenantError && tenantError.code !== 'PGRST116') {
        console.error('Error fetching tenant:', tenantError);
      } else {
        setTenant(tenantData);
      }

      // Buscar resumo financeiro desta propriedade
      const { data: financesData, error: financesError } = await fetchFinancesByProperty(
        initialProperty.id,
        { limit: 5 },
      );

      if (financesError) {
        console.error('Error fetching finances for property:', financesError);
      } else if (financesData) {
        const overview = calculateOverview(financesData);
        setFinancesSummary({
          totalIncome: overview.totalIncome,
          totalExpenses: overview.totalExpenses,
          net: overview.netProfit,
        });
      }

      // Buscar contrato ativo ligado a este imóvel
      const { data: activeContract, error: contractError } = await fetchActiveContractByProperty(
        initialProperty.id,
      );

      if (contractError) {
        console.error('Erro ao buscar contrato ativo da propriedade:', contractError);
      }

      setContract(activeContract || null);

      // Calcular status das faturas com base no contrato ativo
      if (activeContract) {
        const source = {
          property_id: activeContract.property_id,
          tenant_id: activeContract.tenant_id,
          start_date: activeContract.start_date,
          due_date: activeContract.due_day,
          lease_term: activeContract.lease_term,
        };

        const { summary } = await fetchTenantBillingSummary(source);
        setBillingSummary(summary);
      } else {
        setBillingSummary({ expected: 0, paid: 0, overdue: 0 });
      }
      
      setLoading(false);
    };

    if (isFocused) {
      fetchFullPropertyDetails();
    }
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

  const handleAddTransaction = () => {
    navigation.navigate('AddTransaction', {
      preselectedPropertyId: property.id,
    });
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={1} ellipsizeMode="tail">{property.address}</Text>
      </View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotos do Imóvel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {property.image_urls && property.image_urls.length > 0 ? (
                property.image_urls.map((url, index) => (
                <TouchableOpacity key={index} onPress={() => openImageModal(url)}>
                    <Image source={{ uri: url }} style={styles.galleryImage} />
                </TouchableOpacity>
                ))
            ) : (
                <View style={styles.noImageContainer}>
                    <Text style={styles.noImageText}>Nenhuma foto cadastrada</Text>
                </View>
            )}
            </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhes da Propriedade</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{property.type || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quartos</Text>
            <Text style={styles.infoValue}>{property.bedrooms}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Banheiros</Text>
            <Text style={styles.infoValue}>{property.bathrooms}</Text>
          </View>
           <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Área (m²)</Text>
            <Text style={styles.infoValue}>{property.sqft}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total de Cômodos</Text>
            <Text style={styles.infoValue}>{property.total_rooms || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aluguel & Contrato</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Aluguel Mensal</Text>
            <Text style={styles.infoValue}>{formatCurrency(property.rent)}/mês</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{tenant ? 'Alugada' : 'Disponível'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duração do Contrato</Text>
            <Text style={styles.infoValue}>
              {contract?.lease_term != null ? `${contract.lease_term} meses` : 'Nenhum contrato ativo'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status de pagamento</Text>
            <Text
              style={[
                styles.infoValue,
                contract && billingSummary.overdue > 0 && { color: '#F44336', fontWeight: '600' },
              ]}
            >
              {getPaymentStatus()}
            </Text>
          </View>
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

          <View style={styles.financeActions}>
            <TouchableOpacity 
              style={styles.financeActionButton}
              onPress={handleAddTransaction}
            >
              <Text style={styles.financeActionText}>Novo lançamento</Text>
            </TouchableOpacity>
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
                      <MaterialIcons name="close" size={16} color="#F44336" />
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
            style={styles.editButton} 
            onPress={() => navigation.navigate('EditProperty', { property: property })}
          >
            <Text style={styles.buttonText}>Editar Propriedade</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDeleteProperty}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.expense} />
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
              <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} resizeMode="contain" />
          </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContainer: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 50,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    backButton: {
        marginRight: 10,
    },
    header: {
        ...typography.sectionTitle,
        flex: 1,
    },
    section: {
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        marginBottom: 0,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        marginBottom: 10,
    },
    galleryImage: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginRight: 10,
      backgroundColor: '#eee',
    },
    noImageContainer: {
        width: 120,
        height: 120,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noImageText: {
        color: '#999',
        fontSize: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    infoLabel: {
        ...typography.body,
    },
    infoValue: {
        ...typography.bodyStrong,
    },
    tenantCard: {
        backgroundColor: '#f0f7ff',
        borderRadius: radii.md,
        padding: 15,
    },
    tenantHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tenantName: {
        ...typography.bodyStrong,
        marginBottom: 5,
    },
    tenantPhone: {
        color: colors.textSecondary,
    },
    endTenancyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: '#ffebee',
    },
    endTenancyText: {
        marginLeft: 4,
        fontSize: 12,
        color: '#F44336',
        fontWeight: '600',
    },
    tenantActions: {
        marginTop: 10,
    },
    tenantActionButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    tenantActionText: {
        ...typography.button,
        color: colors.primary,
    },
    noTenantText: {
        textAlign: 'center',
        color: colors.textSecondary,
        paddingVertical: 10,
        fontStyle: 'italic',
    },
    buttonContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 20,
    },
    editButton: {
        backgroundColor: colors.primary,
        padding: 15,
        borderRadius: radii.pill,
        flex: 1,
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: 'transparent',
        padding: 15,
        borderRadius: radii.pill,
        flex: 1,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 0,
    },
    secondaryButton: {
        backgroundColor: '#78909C',
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: { 
        ...typography.button,
        color: 'white',
    },
    deleteButtonText: {
        color: colors.expense,
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
        ...typography.caption,
        marginBottom: 4,
    },
    financeValue: {
        ...typography.bodyStrong,
    },
    income: {
        color: '#4CAF50',
    },
    expense: {
        color: '#F44336',
    },
    financeActions: {
        marginTop: 12,
    },
    financeActionButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    financeActionText: {
        ...typography.button,
        color: colors.primary,
    },
});

export default PropertyDetailsScreen;