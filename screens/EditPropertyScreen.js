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
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { supabase } from '../lib/supabase';

const EditPropertyScreen = ({ route, navigation }) => {
  const { property } = route.params;

  // Form state
  const [endereco, setEndereco] = useState('');
  const [tipoPropriedade, setTipoPropriedade] = useState('');
  const [quartos, setQuartos] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [area, setArea] = useState('');
  const [tamanhoLote, setTamanhoLote] = useState('');
  const [aluguel, setAluguel] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tenant Dropdown state
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [initialTenantId, setInitialTenantId] = useState(null);

  // Pre-fill the form with the property's data
  useEffect(() => {
    if (property) {
      setEndereco(property.address || '');
      setTipoPropriedade(property.type || '');
      setQuartos(property.bedrooms?.toString() || '');
      setBanheiros(property.bathrooms?.toString() || '');
      setArea(property.sqft?.toString() || '');
      setTamanhoLote(property.lot_size || '');
      setAluguel(property.rent?.toString() || '');

      // Find the tenant currently associated with this property
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

  // Fetch all available tenants to populate the dropdown
  useEffect(() => {
    const fetchTenants = async () => {
      const { data, error } = await supabase.from('tenants').select('id, full_name');
      if (error) {
        console.error("Error fetching tenants:", error);
      } else {
        const formattedTenants = data.map(t => ({ label: t.full_name, value: t.id }));
        setTenants(formattedTenants);
      }
    };
    fetchTenants();
  }, []);

  const handleUpdateProperty = async () => {
    setLoading(true);
    
    // 1. Update the property details
    const { error: propertyError } = await supabase
      .from('properties')
      .update({
        address: endereco,
        type: tipoPropriedade,
        bedrooms: parseInt(quartos, 10) || null,
        bathrooms: parseInt(banheiros, 10) || null,
        sqft: parseInt(area, 10) || null,
        lot_size: tamanhoLote,
        rent: parseInt(aluguel, 10) || null,
      })
      .eq('id', property.id);

    if (propertyError) {
      Alert.alert('Error updating property', propertyError.message);
      setLoading(false);
      return;
    }

    // 2. If there was an initial tenant, but now it's different or null,
    //    release the old tenant from this property.
    if (initialTenantId && initialTenantId !== tenantId) {
      const { error: clearTenantError } = await supabase
        .from('tenants')
        .update({ property_id: null })
        .eq('id', initialTenantId);
      if (clearTenantError) console.warn("Could not clear previous tenant:", clearTenantError.message);
    }
    
    // 3. If a new tenant is selected, associate them with this property
    if (tenantId && tenantId !== initialTenantId) {
        const { error: tenantError } = await supabase
            .from('tenants')
            .update({ property_id: property.id })
            .eq('id', tenantId);

        if (tenantError) {
            Alert.alert('Error associating new tenant', tenantError.message);
            setLoading(false);
            return;
        }
    }

    Alert.alert('Success', 'Property updated successfully!');
    navigation.goBack();
    setLoading(false);
  };

  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar esta propriedade?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            setIsDeleting(true);
            const { error } = await supabase.from('properties').delete().eq('id', property.id);
            if (error) {
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

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Editar Propriedade</Text>
      </View>
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        {/* Tenant Dropdown */}
        <View style={[styles.inputGroup, { zIndex: 1000 }]}>
          <Text style={styles.label}>Inquilino Associado</Text>
          <DropDownPicker
            open={open}
            value={tenantId}
            items={tenants}
            setOpen={setOpen}
            setValue={setTenantId}
            setItems={setTenants}
            searchable={true}
            placeholder="Selecione um inquilino para alugar"
            listMode="MODAL"
            clearable={true} 
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Endereço</Text>
          <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Propriedade</Text>
          <TextInput style={styles.input} value={tipoPropriedade} onChangeText={setTipoPropriedade} />
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Área (m²)</Text>
          <TextInput style={styles.input} value={area} onChangeText={setArea} keyboardType="numeric" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tamanho do Lote</Text>
          <TextInput style={styles.input} value={tamanhoLote} onChangeText={setTamanhoLote} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor do Aluguel (R$)</Text>
          <TextInput style={styles.input} value={aluguel} onChangeText={setAluguel} keyboardType="decimal-pad" />
        </View>

        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProperty} disabled={loading || isDeleting}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProperty} disabled={loading || isDeleting}>
          {isDeleting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Deletar Propriedade</Text>}
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
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    header: { 
        fontSize: 28, 
        fontWeight: 'bold', 
        color: '#333',
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
        backgroundColor: '#FF9800', 
        padding: 15, 
        borderRadius: 8, 
        alignItems: 'center', 
        marginTop: 10,
    },
    deleteButton: { 
        backgroundColor: '#F44336', 
        padding: 15, 
        borderRadius: 8, 
        alignItems: 'center', 
        marginTop: 10,
    },
    buttonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 16,
    },
});

export default EditPropertyScreen;