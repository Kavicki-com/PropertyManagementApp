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
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker'; // Import the custom component

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
  const [prazoContrato, setPrazoContrato] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date());
  const [dataFim, setDataFim] = useState(new Date());
  const [showDataInicioPicker, setShowDataInicioPicker] = useState(false);
  const [showDataFimPicker, setShowDataFimPicker] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setPrazoContrato(property.lease_term?.toString() || '');
      setDataInicio(property.start_date ? parseISO(property.start_date) : new Date());
      setDataFim(property.end_date ? parseISO(property.end_date) : new Date());

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
        lease_term: parseInt(prazoContrato, 10) || null,
        start_date: dataInicio.toISOString(),
        end_date: dataFim.toISOString(),
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

  const onDataInicioChange = (event, selectedDate) => {
    setShowDataInicioPicker(false);
    if (selectedDate) setDataInicio(selectedDate);
  };

  const onDataFimChange = (event, selectedDate) => {
    setShowDataFimPicker(false);
    if (selectedDate) setDataFim(selectedDate);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Editar Propriedade</Text>

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

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prazo do Contrato (meses)</Text>
        <TextInput style={styles.input} value={prazoContrato} onChangeText={setPrazoContrato} keyboardType="numeric" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Datas do Contrato</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDataInicioPicker(true)}>
            <Text>{format(dataInicio, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>até</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDataFimPicker(true)}>
            <Text>{format(dataFim, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProperty} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
      </TouchableOpacity>

      <CustomDatePicker
        visible={showDataInicioPicker}
        date={dataInicio}
        onDateChange={onDataInicioChange}
        onClose={() => setShowDataInicioPicker(false)}
      />

      <CustomDatePicker
        visible={showDataFimPicker}
        date={dataFim}
        onDateChange={onDataFimChange}
        onClose={() => setShowDataFimPicker(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputGroup: { marginBottom: 20 },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    inputGroupHalf: { width: '48%' },
    label: { marginBottom: 8, fontWeight: '500' },
    input: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16 },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateInput: { flex: 1, height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, justifyContent: 'center' },
    dateSeparator: { marginHorizontal: 10, color: '#666' },
    updateButton: { backgroundColor: '#FF9800', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default EditPropertyScreen;