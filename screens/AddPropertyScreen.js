// screens/AddPropertyScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SelectList } from 'react-native-dropdown-select-list';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { optimizeImage, base64ToArrayBuffer, IMAGE_PICKER_OPTIONS, CAMERA_OPTIONS } from '../lib/imageUtils';
import {
  isValidInteger,
  isValidMoney,
  parseMoney,
  filterOnlyNumbers,
  filterMoney,
  filterAddress,
  filterCep,
  isValidCep,
  filterAddressNumber,
  filterUF,
  filterOnlyLetters,
  isValidUF,
} from '../lib/validation';
import { fetchAddressByCep } from '../lib/cepService';
import { canAddProperty, getActivePropertiesCount, getUserSubscription, getRequiredPlan } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { removeCache, CACHE_KEYS } from '../lib/cacheService';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';

const AddPropertyScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  // Campos de endereço
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Outros campos
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [totalComodos, setTotalComodos] = useState('');
  const [area, setArea] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  // Função para formatar valor monetário durante a digitação
  const formatMoneyInput = (text) => {
    const numbers = text.replace(/\D/g, '');
    if (!numbers) return '';
    const value = parseFloat(numbers) / 100;
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  const [typeValue, setTypeValue] = useState(null);
  const [typeItems] = useState([
    { key: 'Residencial', value: 'Residencial' },
    { key: 'Comercial', value: 'Comercial' },
  ]);

  // Busca endereço pelo CEP
  const handleCepChange = async (text) => {
    const formattedCep = filterCep(text);
    setCep(formattedCep);
    if (errors.cep) setErrors({ ...errors, cep: null });

    if (isValidCep(formattedCep)) {
      setLoadingCep(true);
      const result = await fetchAddressByCep(formattedCep);
      setLoadingCep(false);

      if (result.error) {
        Alert.alert('CEP não encontrado', result.error);
      } else {
        setStreet(result.street || '');
        setNeighborhood(result.neighborhood || '');
        setCity(result.city || '');
        setState(result.state || '');
        setErrors(prev => ({ ...prev, street: null, neighborhood: null, city: null, state: null }));
      }
    }
  };

  const handleImagePicker = async (useCamera = false) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:96', message: 'handleImagePicker chamado', data: { useCamera, imagesCount: images.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion
    if (images.length >= 10) {
      Alert.alert('Limite de fotos', 'Você pode adicionar no máximo 10 fotos por imóvel.');
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:102', message: 'Solicitando permissão', data: { useCamera }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:108', message: 'Permissão recebida', data: { status: permission.status, granted: permission.status === 'granted' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion
    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Você precisa permitir o acesso para adicionar fotos.');
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:113', message: 'Abrindo ImagePicker', data: { useCamera }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
    // #endregion
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(CAMERA_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:119', message: 'Resultado do ImagePicker', data: { hasResult: !!result, canceled: result?.canceled, hasAssets: !!result?.assets, assetsLength: result?.assets?.length, firstAssetUri: result?.assets?.[0]?.uri }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
      // #endregion

      if (!result) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:132', message: 'ERRO: result é null ou undefined', data: { useCamera }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion
        Alert.alert('Erro', 'Não foi possível abrir o seletor de imagens.');
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Otimizar imagem antes de adicionar
        if (asset.uri) {
          const optimized = await optimizeImage(asset.uri);
          setImages([...images, { ...asset, uri: optimized.uri, base64: optimized.base64 || asset.base64 }]);
        } else {
          setImages([...images, asset]);
        }
      } else if (!result.canceled && (!result.assets || result.assets.length === 0)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:139', message: 'ERRO: assets vazio ou undefined', data: { result }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion
        Alert.alert('Erro', 'Não foi possível obter a imagem selecionada.');
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:128', message: 'ERRO capturado no ImagePicker', data: { errorMessage: error.message, errorStack: error.stack, useCamera }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
      // #endregion
      Alert.alert('Erro', `Não foi possível abrir ${useCamera ? 'a câmera' : 'a galeria'}.`);
    }
  };

  const validate = () => {
    const newErrors = {};

    // Validação de CEP
    if (!cep.trim() || !isValidCep(cep)) {
      newErrors.cep = 'CEP é obrigatório (8 dígitos).';
    }

    // Validação de Rua
    if (!street.trim()) {
      newErrors.street = 'Rua/Avenida é obrigatória.';
    } else if (street.trim().length < 3) {
      newErrors.street = 'Rua/Avenida deve ter pelo menos 3 caracteres.';
    }

    // Validação de Número
    if (!number.trim()) {
      newErrors.number = 'Número é obrigatório.';
    }

    // Validação de Bairro
    if (!neighborhood.trim()) {
      newErrors.neighborhood = 'Bairro é obrigatório.';
    } else if (neighborhood.trim().length < 2) {
      newErrors.neighborhood = 'Bairro deve ter pelo menos 2 caracteres.';
    }

    // Validação de Cidade
    if (!city.trim()) {
      newErrors.city = 'Cidade é obrigatória.';
    } else if (city.trim().length < 2) {
      newErrors.city = 'Cidade deve ter pelo menos 2 caracteres.';
    }

    // Validação de Estado
    if (!state.trim() || state.length !== 2) {
      newErrors.state = 'Estado é obrigatório (UF).';
    } else if (!isValidUF(state)) {
      newErrors.state = 'UF inválida.';
    }

    if (!typeValue) {
      newErrors.type = 'Selecione o tipo de propriedade.';
    }

    if (!aluguel.trim()) {
      newErrors.aluguel = 'Informe o valor do aluguel.';
    } else if (!isValidMoney(aluguel, { min: 0.01, max: 9999999.99 })) {
      newErrors.aluguel = 'Valor de aluguel inválido.';
    }

    if (quartos.trim() && !isValidInteger(quartos, { min: 0, max: 50 })) {
      newErrors.quartos = 'Número de quartos inválido (máximo 50).';
    }

    if (banheiros.trim() && !isValidInteger(banheiros, { min: 0, max: 30 })) {
      newErrors.banheiros = 'Número de banheiros inválido (máximo 30).';
    }

    if (totalComodos.trim() && !isValidInteger(totalComodos, { min: 0, max: 100 })) {
      newErrors.totalComodos = 'Total de cômodos inválido (máximo 100).';
    }

    if (area.trim() && !isValidInteger(area, { min: 1, max: 100000 })) {
      newErrors.area = 'Área inválida.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildFullAddress = () => {
    const parts = [];
    if (street) {
      let streetPart = street;
      if (number) streetPart += `, ${number}`;
      if (complement) streetPart += ` - ${complement}`;
      parts.push(streetPart);
    }
    if (neighborhood) parts.push(neighborhood);
    if (city && state) parts.push(`${city} - ${state}`);
    if (cep) parts.push(`CEP: ${cep}`);
    return parts.join(', ');
  };

  const handleAddProperty = async () => {
    if (!validate()) {
      Alert.alert('Verifique os dados', 'Alguns campos precisam de atenção antes de salvar.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado para adicionar uma propriedade.');
      setLoading(false);
      return;
    }

    // Validar limite de imóveis antes de continuar
    const canAdd = await canAddProperty(user.id);
    if (!canAdd) {
      setLoading(false);
      const propertyCount = await getActivePropertiesCount(user.id);
      const subscription = await getUserSubscription(user.id);
      const currentPlan = subscription?.subscription_plan || 'free';
      // Se o plano atual é basic, sempre sugere premium
      const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(propertyCount + 1);

      setSubscriptionInfo({
        currentPlan,
        propertyCount,
        requiredPlan,
      });
      setShowUpgradeModal(true);
      return;
    }

    // Upload de imagens em paralelo
    const imageUrls = [];
    const uploadPromises = images.map(async (image, index) => {
      try {
        const fileName = `${user.id}/${Date.now()}_${index}.jpg`;
        const bucketName = 'property-images';

        // Usar base64 otimizado se disponível
        const arrayBuffer = image.base64
          ? base64ToArrayBuffer(image.base64)
          : null;

        if (!arrayBuffer && image.uri) {
          // Se não tem base64, otimizar novamente
          const optimized = await optimizeImage(image.uri);
          if (optimized.base64) {
            const ab = base64ToArrayBuffer(optimized.base64);
            const { error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(fileName, ab, { contentType: 'image/jpeg' });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
              return urlData?.publicUrl;
            }
          }
          return null;
        }

        if (arrayBuffer) {
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            return urlData?.publicUrl;
          }
        }

        return null;
      } catch (error) {
        console.error(`Erro ao fazer upload da imagem ${index}:`, error);
        return null;
      }
    });

    // Aguardar todos os uploads em paralelo
    const results = await Promise.allSettled(uploadPromises);
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        imageUrls.push(result.value);
      }
    });

    if (imageUrls.length === 0 && images.length > 0) {
      Alert.alert('Erro no Upload', 'Não foi possível fazer upload das imagens.');
      setLoading(false);
      return;
    }

    const parsedQuartos = quartos ? parseInt(filterOnlyNumbers(quartos), 10) : null;
    const parsedBanheiros = banheiros ? parseInt(filterOnlyNumbers(banheiros), 10) : null;
    const parsedTotalComodos = totalComodos ? parseInt(filterOnlyNumbers(totalComodos), 10) : null;
    const parsedArea = area ? parseInt(filterOnlyNumbers(area), 10) : null;
    const parsedAluguel = aluguel ? (parseFloat(aluguel) / 100) : null;

    if (parsedAluguel === null || isNaN(parsedAluguel) || parsedAluguel <= 0) {
      Alert.alert('Erro', 'Valor do aluguel inválido.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('properties').insert({
      user_id: user.id,
      address: buildFullAddress(),
      cep: cep.replace(/\D/g, ''),
      street,
      number,
      neighborhood,
      city,
      state,
      complement: complement || null,
      type: typeValue,
      bedrooms: parsedQuartos,
      bathrooms: parsedBanheiros,
      total_rooms: parsedTotalComodos,
      sqft: parsedArea,
      rent: parsedAluguel,
      image_urls: imageUrls,
    });

    if (insertError) {
      Alert.alert('Erro ao adicionar propriedade', insertError.message);
    } else {
      // Invalidar cache de propriedades
      await removeCache(CACHE_KEYS.PROPERTIES);

      // Buscar o imóvel recém-criado para navegar para detalhes
      const { data: newProperties, error: fetchError } = await supabase
        .from('properties')
        .select('id, address, street, number, neighborhood, city, state, cep, complement, type, bedrooms, bathrooms, total_rooms, sqft, rent, image_urls, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !newProperties) {
        Alert.alert('Sucesso', 'Propriedade adicionada com sucesso!');
        navigation.goBack();
      } else {
        Alert.alert('Sucesso', 'Propriedade adicionada com sucesso!');
        navigation.replace('PropertyDetails', { property: newProperties });
      }
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>Adicionar Propriedade</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Endereço</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CEP *</Text>
          <View style={styles.cepRow}>
            <TextInput
              style={[styles.input, styles.cepInput, errors.cep && styles.inputError]}
              placeholder="00000-000"
              value={cep}
              onChangeText={handleCepChange}
              keyboardType="numeric"
              maxLength={9}
            />
            {loadingCep && <ActivityIndicator size="small" color={theme.colors.primary} style={styles.cepLoader} />}
          </View>
          {errors.cep && <Text style={styles.errorText}>{errors.cep}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Rua / Avenida *</Text>
          <TextInput
            style={[styles.input, errors.street && styles.inputError]}
            placeholder="Nome da rua ou avenida"
            value={street}
            onChangeText={(text) => {
              setStreet(filterAddress(text));
              if (errors.street) setErrors({ ...errors, street: null });
            }}
          />
          {errors.street && <Text style={styles.errorText}>{errors.street}</Text>}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroupSmall}>
            <Text style={styles.label}>Número *</Text>
            <TextInput
              style={[styles.input, errors.number && styles.inputError]}
              placeholder="123"
              value={number}
              onChangeText={(text) => {
                setNumber(filterAddressNumber(text));
                if (errors.number) setErrors({ ...errors, number: null });
              }}
              keyboardType="numeric"
              maxLength={10}
            />
            {errors.number && <Text style={styles.errorText}>{errors.number}</Text>}
          </View>
          <View style={styles.inputGroupLarge}>
            <Text style={styles.label}>Complemento</Text>
            <TextInput
              style={styles.input}
              placeholder="Apto, Bloco, etc."
              value={complement}
              onChangeText={(text) => setComplement(filterAddress(text))}
              maxLength={100}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bairro *</Text>
          <TextInput
            style={[styles.input, errors.neighborhood && styles.inputError]}
            placeholder="Nome do bairro"
            value={neighborhood}
            onChangeText={(text) => {
              setNeighborhood(filterOnlyLetters(text));
              if (errors.neighborhood) setErrors({ ...errors, neighborhood: null });
            }}
          />
          {errors.neighborhood && <Text style={styles.errorText}>{errors.neighborhood}</Text>}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroupLarge}>
            <Text style={styles.label}>Cidade *</Text>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              placeholder="Nome da cidade"
              value={city}
              onChangeText={(text) => {
                setCity(filterOnlyLetters(text));
                if (errors.city) setErrors({ ...errors, city: null });
              }}
            />
            {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
          </View>
          <View style={styles.inputGroupSmall}>
            <Text style={styles.label}>Estado *</Text>
            <TextInput
              style={[styles.input, errors.state && styles.inputError]}
              placeholder="UF"
              value={state}
              onChangeText={(text) => {
                setState(filterUF(text));
                if (errors.state) setErrors({ ...errors, state: null });
              }}
              maxLength={2}
              autoCapitalize="characters"
            />
            {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalhes do Imóvel</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Propriedade *</Text>
          <SelectList
            setSelected={(val) => setTypeValue(val)}
            data={typeItems}
            save="key"
            placeholder="Selecione o tipo"
            defaultOption={typeValue ? typeItems.find(t => t.key === typeValue) : undefined}
            boxStyles={styles.dropdown}
            inputStyles={styles.dropdownText}
            dropdownStyles={styles.dropdownContainer}
            search={false}
          />
          {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Quartos</Text>
            <TextInput
              style={[styles.input, errors.quartos && styles.inputError]}
              placeholder="Ex: 3"
              value={quartos}
              onChangeText={(text) => {
                setQuartos(filterOnlyNumbers(text));
                if (errors.quartos) setErrors({ ...errors, quartos: null });
              }}
              keyboardType="numeric"
              maxLength={2}
            />
            {errors.quartos && <Text style={styles.errorText}>{errors.quartos}</Text>}
          </View>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Banheiros</Text>
            <TextInput
              style={[styles.input, errors.banheiros && styles.inputError]}
              placeholder="Ex: 2"
              value={banheiros}
              onChangeText={(text) => {
                setBanheiros(filterOnlyNumbers(text));
                if (errors.banheiros) setErrors({ ...errors, banheiros: null });
              }}
              keyboardType="numeric"
              maxLength={2}
            />
            {errors.banheiros && <Text style={styles.errorText}>{errors.banheiros}</Text>}
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Total de Cômodos</Text>
            <TextInput
              style={[styles.input, errors.totalComodos && styles.inputError]}
              placeholder="Ex: 8"
              value={totalComodos}
              onChangeText={(text) => {
                setTotalComodos(filterOnlyNumbers(text));
                if (errors.totalComodos) setErrors({ ...errors, totalComodos: null });
              }}
              keyboardType="numeric"
              maxLength={3}
            />
            {errors.totalComodos && <Text style={styles.errorText}>{errors.totalComodos}</Text>}
          </View>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Área (m²)</Text>
            <TextInput
              style={[styles.input, errors.area && styles.inputError]}
              placeholder="Ex: 150"
              value={area}
              onChangeText={(text) => setArea(filterOnlyNumbers(text))}
              keyboardType="numeric"
            />
            {errors.area && <Text style={styles.errorText}>{errors.area}</Text>}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor do Aluguel (R$) *</Text>
          <TextInput
            style={[styles.input, errors.aluguel && styles.inputError]}
            placeholder="R$ 0,00"
            value={aluguel ? formatMoneyInput(aluguel) : ''}
            onChangeText={(text) => {
              const numbers = text.replace(/\D/g, '');
              setAluguel(numbers);
              if (errors.aluguel) setErrors({ ...errors, aluguel: null });
            }}
            keyboardType="numeric"
          />
          {errors.aluguel && <Text style={styles.errorText}>{errors.aluguel}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Fotos do Imóvel</Text>

        <View style={styles.inputGroup}>
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:531', message: 'Botão Câmera pressionado', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'A' }) }).catch(() => { });
              // #endregion
              handleImagePicker(true);
            }}>
              <MaterialIcons name="photo-camera" size={24} color={theme.colors.primary} />
              <Text style={styles.imagePickerText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/a9d38169-72e4-438e-b902-636c2481741c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AddPropertyScreen.js:535', message: 'Botão Galeria pressionado', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run2', hypothesisId: 'A' }) }).catch(() => { });
              // #endregion
              handleImagePicker(false);
            }}>
              <MaterialIcons name="photo-library" size={24} color={theme.colors.primary} />
              <Text style={styles.imagePickerText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
            {images.map((image, index) => (
              <View key={index} style={styles.thumbnailWrapper}>
                <Image
                  source={image.uri}
                  style={styles.thumbnail}
                  contentFit="cover"
                  cachePolicy="memory"
                />
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddProperty} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={styles.addButtonText}>Adicionar Propriedade</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

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
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    padding: 5,
  },
  header: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.textPrimary,
    marginBottom: 15,
    marginTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputGroupHalf: {
    width: '48%',
  },
  inputGroupSmall: {
    width: '30%',
  },
  inputGroupLarge: {
    width: '66%',
  },
  label: {
    marginBottom: 6,
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    ...theme.typography.body,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 2,
  },
  errorText: {
    marginTop: 4,
    color: theme.colors.danger,
    ...theme.typography.caption,
  },
  cepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cepInput: {
    flex: 1,
  },
  cepLoader: {
    marginLeft: 10,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    ...theme.typography.body,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  addButtonText: {
    color: theme.colors.surface,
    ...theme.typography.button,
  },
  imagePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: theme.radii.pill,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  imagePickerText: {
    marginLeft: 8,
    color: theme.colors.primary,
    ...theme.typography.bodyStrong,
  },
  thumbnailContainer: {
    marginTop: 12,
  },
  thumbnailWrapper: {
    marginRight: 10,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
});

export default AddPropertyScreen;
