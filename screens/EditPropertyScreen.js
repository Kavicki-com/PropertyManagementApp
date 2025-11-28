// screens/EditPropertyScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SelectList } from 'react-native-dropdown-select-list';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

const decode = (base64) => {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const EditPropertyScreen = ({ route, navigation }) => {
  const { property } = route.params;

  const [endereco, setEndereco] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [totalComodos, setTotalComodos] = useState('');
  const [area, setArea] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  const [typeValue, setTypeValue] = useState('');
  const [typeItems] = useState([
    { key: 'Residencial', value: 'Residencial' },
    { key: 'Comercial', value: 'Comercial' },
  ]);

  useEffect(() => {
    if (property) {
      setEndereco(property.address || '');
      setTypeValue(property.type || '');
      setQuartos(property.bedrooms?.toString() || '');
      setBanheiros(property.bathrooms?.toString() || '');
      setTotalComodos(property.total_rooms?.toString() || '');
      setArea(property.sqft?.toString() || '');
      setAluguel(property.rent?.toString() || '');
      setImages(property.image_urls || []);
    }
  }, [property]);

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
      setImages([...images, { uri: result.assets[0].uri, base64: result.assets[0].base64, isNew: true }]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
  };

  const validate = () => {
    const newErrors = {};

    if (!endereco.trim()) {
      newErrors.endereco = 'Endereço é obrigatório.';
    }
    if (!typeValue) {
      newErrors.type = 'Selecione o tipo de propriedade.';
    }

    const parsedRent = parseInt(aluguel.replace(/[^0-9]/g, ''), 10);
    if (!aluguel.trim()) {
      newErrors.aluguel = 'Informe o valor do aluguel.';
    } else if (isNaN(parsedRent) || parsedRent <= 0) {
      newErrors.aluguel = 'Informe um valor de aluguel válido (maior que 0).';
    }

    if (area.trim()) {
      const parsedArea = parseInt(area.replace(/[^0-9]/g, ''), 10);
      if (isNaN(parsedArea) || parsedArea <= 0) {
        newErrors.area = 'Informe uma área válida (maior que 0).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProperty = async () => {
    if (!validate()) {
      Alert.alert('Verifique os dados', 'Alguns campos precisam de atenção antes de salvar.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const finalImageUrls = [];
    for (const image of images) {
      if (typeof image === 'string') {
        finalImageUrls.push(image);
      } else if (image.isNew) {
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
        
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        finalImageUrls.push(urlData.publicUrl);
      }
    }

    const parsedQuartos = quartos ? parseInt(quartos.replace(/[^0-9]/g, ''), 10) : null;
    const parsedBanheiros = banheiros ? parseInt(banheiros.replace(/[^0-9]/g, ''), 10) : null;
    const parsedTotalComodos = totalComodos ? parseInt(totalComodos.replace(/[^0-9]/g, ''), 10) : null;
    const parsedArea = area ? parseInt(area.replace(/[^0-9]/g, ''), 10) : null;
    const parsedAluguel = aluguel ? parseInt(aluguel.replace(/[^0-9]/g, ''), 10) : null;

    const { error: propertyError } = await supabase
      .from('properties')
      .update({
        address: endereco,
        type: typeValue,
        bedrooms: parsedQuartos || null,
        bathrooms: parsedBanheiros || null,
        total_rooms: parsedTotalComodos || null,
        sqft: parsedArea || null,
        rent: parsedAluguel || null,
        image_urls: finalImageUrls,
      })
      .eq('id', property.id);

    if (propertyError) {
      Alert.alert('Erro ao atualizar propriedade', propertyError.message);
      setLoading(false);
      return;
    }

    Alert.alert('Sucesso', 'Propriedade atualizada!');
    navigation.goBack();
    setLoading(false);
  };

  // O restante do componente (return e styles) permanece igual...
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>Editar Propriedade</Text>
        <View style={{ width: 24 }} /> 
      </View>
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Endereço</Text>
          <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} />
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
              style={styles.input}
              value={quartos}
              onChangeText={(text) => setQuartos(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Banheiros</Text>
            <TextInput
              style={styles.input}
              value={banheiros}
              onChangeText={(text) => setBanheiros(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
          </View>
        </View>
        
        <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Total de Cômodos</Text>
                <TextInput
                  style={styles.input}
                  value={totalComodos}
                  onChangeText={(text) => setTotalComodos(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                />
            </View>
            <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Área (m²)</Text>
                <TextInput
                  style={styles.input}
                  value={area}
                  onChangeText={(text) => setArea(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                />
            </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor do Aluguel (R$)</Text>
          <TextInput
            style={styles.input}
            value={aluguel}
            onChangeText={(text) => setAluguel(text.replace(/[^0-9]/g, ''))}
            keyboardType="decimal-pad"
          />
          {errors.aluguel && <Text style={styles.errorText}>{errors.aluguel}</Text>}
        </View>

        {/* Seção de Gerenciamento de Imagens */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fotos do Imóvel</Text>
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => handleImagePicker(true)}>
              <MaterialIcons name="photo-camera" size={24} color="#4a86e8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.imagePickerButton} onPress={() => handleImagePicker(false)}>
              <MaterialIcons name="photo-library" size={24} color="#4a86e8" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
            {images.map((image, index) => (
              <View key={index} style={styles.thumbnailWrapper}>
                <Image source={{ uri: typeof image === 'string' ? image : image.uri }} style={styles.thumbnail} />
                <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                  <MaterialIcons name="cancel" size={24} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProperty} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
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
    },
    input: { 
        height: 50, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        borderRadius: 8, 
        paddingHorizontal: 15, 
        fontSize: 16,
    },
    updateButton: { 
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
    buttonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 16,
    },
    imagePickerContainer: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    imagePickerButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        padding: 10,
        borderRadius: 8,
        height: 50,
        width: 50,
        marginRight: 10,
    },
    thumbnailContainer: {
        flexDirection: 'row',
    },
    thumbnailWrapper: {
        position: 'relative',
        marginRight: 10,
    },
    thumbnail: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    removeImageButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: 'white',
        borderRadius: 12,
    },
    errorText: {
        marginTop: 4,
        color: '#F44336',
        fontSize: 12,
    },
});

export default EditPropertyScreen;