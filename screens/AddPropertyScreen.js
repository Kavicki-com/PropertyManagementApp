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
  Image,
} from 'react-native';
import { SelectList } from 'react-native-dropdown-select-list';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';
import { isValidInteger, isValidMoney, parseMoney, filterOnlyNumbers, filterMoney, filterAddress } from '../lib/validation';

const decode = (base64) => {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const AddPropertyScreen = ({ navigation }) => {
  const [endereco, setEndereco] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [totalComodos, setTotalComodos] = useState('');
  const [area, setArea] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  const [typeValue, setTypeValue] = useState(null);
  const [typeItems] = useState([
    { key: 'Residencial', value: 'Residencial' },
    { key: 'Comercial', value: 'Comercial' },
  ]);

  const handleImagePicker = async (useCamera = false) => {
    if (images.length >= 10) {
      Alert.alert('Limite de fotos', 'Você pode adicionar no máximo 10 fotos por imóvel.');
      return;
    }

    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Você precisa permitir o acesso para adicionar fotos.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (!result.canceled) {
      setImages([...images, result.assets[0]]);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!endereco.trim()) {
      newErrors.endereco = 'Endereço é obrigatório.';
    }
    if (!typeValue) {
      newErrors.type = 'Selecione o tipo de propriedade.';
    }

    // Validação de aluguel usando parseFloat para preservar decimais
    if (!aluguel.trim()) {
      newErrors.aluguel = 'Informe o valor do aluguel.';
    } else if (!isValidMoney(aluguel, { min: 0.01, max: 9999999.99 })) {
      newErrors.aluguel = 'Informe um valor de aluguel válido (entre R$ 0,01 e R$ 9.999.999,99).';
    }

    // Validação de quartos com limites realistas
    if (quartos.trim()) {
      if (!isValidInteger(quartos, { min: 0, max: 50 })) {
        newErrors.quartos = 'Número de quartos inválido (máximo 50).';
      }
    }

    // Validação de banheiros com limites realistas
    if (banheiros.trim()) {
      if (!isValidInteger(banheiros, { min: 0, max: 30 })) {
        newErrors.banheiros = 'Número de banheiros inválido (máximo 30).';
      }
    }

    // Validação de total de cômodos com limites realistas
    if (totalComodos.trim()) {
      if (!isValidInteger(totalComodos, { min: 0, max: 100 })) {
        newErrors.totalComodos = 'Total de cômodos inválido (máximo 100).';
      }
    }

    // Validação de área com limites realistas
    if (area.trim()) {
      if (!isValidInteger(area, { min: 1, max: 100000 })) {
        newErrors.area = 'Área inválida (entre 1 e 100.000 m²).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

    const imageUrls = [];
    for (const image of images) {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      // --- PONTO DE CORREÇÃO ---
      // Verifique se o nome 'property-images' é exatamente igual ao nome do seu bucket no Supabase.
      const bucketName = 'property-images';
      
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, decode(image.base64), { contentType: 'image/jpeg' });

      if (uploadError) {
        Alert.alert('Erro no Upload', `Bucket não encontrado ou erro ao enviar: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      if (urlData) {
        imageUrls.push(urlData.publicUrl);
      }
    }

    // Parse de valores numéricos com validação
    const parsedQuartos = quartos ? parseInt(quartos.replace(/[^0-9]/g, ''), 10) : null;
    const parsedBanheiros = banheiros ? parseInt(banheiros.replace(/[^0-9]/g, ''), 10) : null;
    const parsedTotalComodos = totalComodos ? parseInt(totalComodos.replace(/[^0-9]/g, ''), 10) : null;
    const parsedArea = area ? parseInt(area.replace(/[^0-9]/g, ''), 10) : null;
    
    // Usa parseFloat para preservar decimais no valor do aluguel
    const parsedAluguel = aluguel ? parseMoney(aluguel) : null;
    
    // Validação final antes de salvar
    if (parsedAluguel === null || isNaN(parsedAluguel) || parsedAluguel <= 0) {
      Alert.alert('Erro', 'Valor do aluguel inválido.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('properties').insert({
      user_id: user.id,
      address: endereco,
      type: typeValue,
      bedrooms: parsedQuartos || null,
      bathrooms: parsedBanheiros || null,
      total_rooms: parsedTotalComodos || null,
      sqft: parsedArea || null,
      rent: parsedAluguel || null,
      image_urls: imageUrls,
    });

    if (insertError) {
      Alert.alert('Erro ao adicionar propriedade', insertError.message);
    } else {
      Alert.alert('Sucesso', 'Propriedade adicionada com sucesso!');
      navigation.goBack();
    }

    setLoading(false);
  };
  
  // O restante do componente (return e styles) permanece igual...
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>Adicionar Propriedade</Text>
        <View style={{ width: 24 }} /> 
      </View>
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Endereço</Text>
            <TextInput
            style={styles.input}
            placeholder="Digite o endereço completo"
            value={endereco}
            onChangeText={(text) => setEndereco(filterAddress(text))}
            />
            {errors.endereco && <Text style={styles.errorText}>{errors.endereco}</Text>}
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Propriedade</Text>
            <SelectList
                setSelected={(val) => setTypeValue(val)}
                data={typeItems}
                save="key"
                placeholder="Selecione o tipo de propriedade"
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
                style={styles.input}
                placeholder="Ex: 150"
                value={area}
                onChangeText={(text) => setArea(filterOnlyNumbers(text))}
                keyboardType="numeric"
            />
            {errors.area && <Text style={styles.errorText}>{errors.area}</Text>}
            </View>
        </View>
        
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor do Aluguel (R$)</Text>
            <TextInput
            style={[styles.input, errors.aluguel && styles.inputError]}
            placeholder="Ex: 1800,50"
            value={aluguel}
            onChangeText={(text) => {
                setAluguel(filterMoney(text));
                if (errors.aluguel) setErrors({ ...errors, aluguel: null });
            }}
            keyboardType="decimal-pad"
            />
            {errors.aluguel && <Text style={styles.errorText}>{errors.aluguel}</Text>}
        </View>

        {/* Seção de Imagens */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fotos do Imóvel</Text>
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => handleImagePicker(true)}>
              <MaterialIcons name="photo-camera" size={24} color="#4a86e8" />
              <Text style={styles.imagePickerText}>Tirar Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => handleImagePicker(false)}>
              <MaterialIcons name="photo-library" size={24} color="#4a86e8" />
              <Text style={styles.imagePickerText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
            {images.map((image, index) => (
              <View key={index} style={styles.thumbnailWrapper}>
                <Image source={{ uri: image.uri }} style={styles.thumbnail} />
              </View>
            ))}
          </ScrollView>
        </View>


        <TouchableOpacity style={styles.addButton} onPress={handleAddProperty} disabled={loading}>
            {loading ? (
            <ActivityIndicator color="white" />
            ) : (
            <Text style={styles.addButtonText}>Adicionar Propriedade</Text>
            )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
      },
    backButton: {
        padding: 5,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'left',
        flex: 1,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    inputGroupHalf: {
      width: '48%',
    },
    label: {
      marginBottom: 8,
      fontWeight: '500',
      color: '#333',
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 15,
      fontSize: 16,
      backgroundColor: '#f9f9f9',
    },
    addButton: {
      backgroundColor: '#4a86e8',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 40,
    },
    dropdown: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      minHeight: 50,
      overflow: 'hidden',
    },
    dropdownText: {
      fontSize: 16,
      color: '#333',
    },
    dropdownContainer: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      backgroundColor: '#fff',
    },
    addButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
    imagePickerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    imagePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f0f0f0',
      padding: 10,
      borderRadius: 8,
      flex: 1,
      justifyContent: 'center',
      marginHorizontal: 5,
    },
    imagePickerText: {
      marginLeft: 10,
      color: '#4a86e8',
      fontWeight: 'bold',
    },
    thumbnailContainer: {
      marginTop: 15,
    },
    thumbnailWrapper: {
      marginRight: 10,
    },
    thumbnail: {
      width: 100,
      height: 100,
      borderRadius: 8,
      marginRight: 10,
      borderWidth: 1,
      borderColor: '#ddd',
    },
    errorText: {
      marginTop: 4,
      color: '#F44336',
      fontSize: 12,
    },
    inputError: {
      borderColor: '#F44336',
      borderWidth: 2,
    },
  });

export default AddPropertyScreen;