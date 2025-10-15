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
    SafeAreaView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const PropertyDetailsScreen = ({ route, navigation }) => {
  const { property: initialProperty } = route.params;

  const [property, setProperty] = useState(null); 
  const [tenant, setTenant] = useState(null);
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
        .select('full_name, phone')
        .eq('property_id', initialProperty.id)
        .single();

      if (tenantError && tenantError.code !== 'PGRST116') {
        console.error('Error fetching tenant:', tenantError);
      } else {
        setTenant(tenantData);
      }
      
      setLoading(false);
    };

    if (isFocused) {
      fetchFullPropertyDetails();
    }
  }, [isFocused, initialProperty?.id]);

  // --- CORREÇÃO APLICADA AQUI ---
  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Deseja realmente deletar esta propriedade? Seus registros financeiros serão REMOVIDOS e o inquilino será DESVINCULADO.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            setIsDeleting(true);

            // Etapa 1: Deletar os registros financeiros permanentemente
            const { error: financeError } = await supabase
              .from('finances')
              .delete() // <-- Ação: DELETAR
              .eq('property_id', property.id);

            if (financeError) {
              Alert.alert('Erro', 'Não foi possível deletar os registros financeiros.');
              setIsDeleting(false);
              return;
            }
            
            // Etapa 2: Desvincular o inquilino (não deletar)
            const { error: tenantError } = await supabase
              .from('tenants')
              .update({ property_id: null }) // <-- Ação: ATUALIZAR para nulo
              .eq('property_id', property.id);

            if (tenantError) {
              Alert.alert('Erro', 'Não foi possível desvincular o inquilino.');
              setIsDeleting(false);
              return;
            }

            // Etapa 3: Deletar as imagens do Storage
            if (property.image_urls && property.image_urls.length > 0) {
              const bucketName = 'property-images';
              const filePaths = property.image_urls.map(url => url.split(`${bucketName}/`)[1]).filter(Boolean);
              if (filePaths.length > 0) {
                await supabase.storage.from(bucketName).remove(filePaths);
              }
            }

            // Etapa 4: Deletar a propriedade
            const { error: deleteError } = await supabase.from('properties').delete().eq('id', property.id);
            
            if (deleteError) {
              Alert.alert('Erro', 'Não foi possível deletar a propriedade.');
            } else {
              Alert.alert('Sucesso', 'Propriedade deletada.');
              navigation.goBack();
            }
            setIsDeleting(false);
          },
          style: 'destructive' 
        }
      ]
    );
  };
  // --- FIM DA CORREÇÃO ---
  
  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
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
            <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
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
            <Text style={styles.infoValue}>R${property.rent}/mês</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inquilino(s)</Text>
          {tenant ? (
              <View style={styles.tenantCard}>
                  <Text style={styles.tenantName}>{tenant.full_name}</Text>
                  <Text style={styles.tenantPhone}>{tenant.phone}</Text>
              </View>
          ) : (
              <Text style={styles.noTenantText}>Nenhum inquilino associado.</Text>
          )}
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
            {isDeleting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Deletar Propriedade</Text>}
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
        backgroundColor: '#f5f5f5',
    },
    scrollContainer: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    backButton: {
        marginRight: 10,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        marginBottom: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
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
        color: '#666',
        fontSize: 16,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
    },
    tenantCard: {
        backgroundColor: '#f0f7ff',
        borderRadius: 8,
        padding: 15,
    },
    tenantName: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 5,
    },
    tenantPhone: {
        color: '#666',
    },
    noTenantText: {
        textAlign: 'center',
        color: '#666',
        paddingVertical: 10,
        fontStyle: 'italic',
    },
    buttonContainer: {
        flexDirection: 'column',
        gap: 8,
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 20,
    },
    editButton: {
        backgroundColor: '#4a86e8',
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: '#F44336',
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    buttonText: { 
        color: 'white',
        fontWeight: 'bold',
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
});

export default PropertyDetailsScreen;