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
import DropDownPicker from 'react-native-dropdown-picker';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

// Função para decodificar a imagem para o upload no Supabase
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

  // Estados do formulário
  const [endereco, setEndereco] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [totalComodos, setTotalComodos] = useState('');
  const [area, setArea] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]); // Armazena URLs existentes e objetos de novas imagens

  // Estado do Dropdown de Tipo
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeValue, setTypeValue] = useState('');
  const [typeItems, setTypeItems] = useState([
    { label: 'Residencial', value: 'Residencial' },
    { label: 'Comercial', value: 'Comercial' },
  ]);

  // Estado do Dropdown de Inquilino
  const [tenantOpen, setTenantOpen] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [initialTenantId, setInitialTenantId] = useState(null);

  // Preenche o formulário com os dados da propriedade
  useEffect(() => {
    if (property) {
      setEndereco(property.address || '');
      setTypeValue(property.type || '');
      setQuartos(property.bedrooms?.toString() || '');
      setBanheiros(property.bathrooms?.toString() || '');
      setTotalComodos(property.total_rooms?.toString() || '');
      setArea(property.sqft?.toString() || '');
      setAluguel(property.rent?.toString() || '');
      setImages(property.image_urls || []); // Carrega as imagens existentes

      // Busca o inquilino atual
      const fetchCurrentTenant = async () => {
        const { data } = await supabase
          .from('tenants')
          .select('id')
          .eq('property_id', property.id)
          .single();
        if (data) {
          setTenantId(data.id);
          setInitialTenantId(data.id);
        }
      };
      fetchCurrentTenant();
    }
  }, [property]);

  // Busca todos os inquilinos disponíveis
  useEffect(() => {
    const fetchTenants = async () => {
      const { data, error } = await supabase.from('tenants').select('id, full_name');
      if (error) {
        console.error("Error fetching tenants:", error);
      } else {
        const formattedTenants = data.map(t => ({ label: t.full_name, value: t.id }));
        setTenants([
            { label: 'Tornar vago (sem inquilino)', value: null },
            ...formattedTenants
        ]);
      }
    };
    fetchTenants();
  }, []);

  const handleImagePicker = async (useCamera = false) => {
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
      // Adiciona um objeto diferenciado para novas imagens
      setImages([...images, { uri: result.assets[0].uri, base64: result.assets[0].base64, isNew: true }]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
  };


  const handleUpdateProperty = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Gerenciar Imagens
    const finalImageUrls = [];
    for (const image of images) {
      if (typeof image === 'string') { // Imagem existente (URL)
        finalImageUrls.push(image);
      } else if (image.isNew) { // Nova imagem para upload
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(fileName, decode(image.base64), { contentType: 'image/jpeg' });
        
        if (uploadError) {
          Alert.alert('Erro no Upload', uploadError.message);
          setLoading(false);
          return;
        }
        
        const { data: urlData } = supabase.storage.from('property-images').getPublicUrl(fileName);
        finalImageUrls.push(urlData.publicUrl);
      }
    }

    // 2. Atualizar os detalhes da propriedade
    const { error: propertyError } = await supabase
      .from('properties')
      .update({
        address: endereco,
        type: typeValue,
        bedrooms: parseInt(quartos, 10) || null,
        bathrooms: parseInt(banheiros, 10) || null,
        total_rooms: parseInt(totalComodos, 10) || null,
        sqft: parseInt(area, 10) || null,
        rent: parseInt(aluguel, 10) || null,
        image_urls: finalImageUrls,
      })
      .eq('id', property.id);

    if (propertyError) {
      Alert.alert('Erro ao atualizar propriedade', propertyError.message);
      setLoading(false);
      return;
    }

    // 3. Lógica de associação de inquilino (mantida)
    if (initialTenantId && tenantId === null) {
        await supabase.from('tenants').update({ property_id: null }).eq('id', initialTenantId);
    } else if (tenantId !== initialTenantId) {
        if (initialTenantId) {
            await supabase.from('tenants').update({ property_id: null }).eq('id', initialTenantId);
        }
        await supabase.from('tenants').update({ property_id: property.id }).eq('id', tenantId);
    }

    Alert.alert('Sucesso', 'Propriedade atualizada!');
    navigation.goBack();
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>Editar Propriedade</Text>
        <View style={{ width: 24 }} /> 
      </View>
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        <View style={[styles.inputGroup, { zIndex: 2000 }]}>
          <Text style={styles.label}>Inquilino Associado</Text>
          <DropDownPicker
            open={tenantOpen}
            value={tenantId}
            items={tenants}
            setOpen={setTenantOpen}
            setValue={setTenantId}
            setItems={setTenants}
            searchable={true}
            placeholder="Selecione um inquilino"
            listMode="MODAL"
            zIndex={2000}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Endereço</Text>
          <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} />
        </View>

        <View style={[styles.inputGroup, { zIndex: 1000 }]}>
            <Text style={styles.label}>Tipo de Propriedade</Text>
            <DropDownPicker
                open={typeOpen}
                value={typeValue}
                items={typeItems}
                setOpen={setTypeOpen}
                setValue={setTypeValue}
                setItems={setTypeItems}
                placeholder="Selecione o tipo"
                listMode="MODAL"
                zIndex={1000}
            />
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Quartos</Text>
            <TextInput style={styles.input} value={quartos} onChangeText={setQuartos} keyboardType="numeric" />
          </View>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Banheiros</Text>
            <TextInput style={styles.input} value={banheiros} onChangeText={setBanheiros} keyboardType="numeric" />
          </View>
        </View>
        
        <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Total de Cômodos</Text>
                <TextInput style={styles.input} value={totalComodos} onChangeText={setTotalComodos} keyboardType="numeric" />
            </View>
            <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Área (m²)</Text>
                <TextInput style={styles.input} value={area} onChangeText={setArea} keyboardType="numeric" />
            </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor do Aluguel (R$)</Text>
          <TextInput style={styles.input} value={aluguel} onChangeText={setAluguel} keyboardType="decimal-pad" />
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
});

export default EditPropertyScreen;