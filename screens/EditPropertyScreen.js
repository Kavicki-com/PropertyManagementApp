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
import CustomDatePicker from '../components/CustomDatePicker'; // 1. Import the custom component

const EditPropertyScreen = ({ route, navigation }) => {
  const { property } = route.params;

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
  
  const [loading, setLoading] = useState(true);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [tenantValue, setTenantValue] = useState(null);
  const [tenantItems, setTenantItems] = useState([]);
  const [originalTenantId, setOriginalTenantId] = useState(null);

  useEffect(() => {
    const fetchTenantsAndProperty = async () => {
      setLoading(true);
      if (property) {
        setEndereco(property.address || '');
        setTipoPropriedade(property.type || '');
        setQuartos(property.bedrooms?.toString() || '');
        setBanheiros(property.bathrooms?.toString() || '');
        setArea(property.sqft?.toString() || '');
        setTamanhoLote(property.lot_size || '');
        setAluguel(property.rent?.toString() || '');
        setPrazoContrato(property.lease_term?.toString() || '');
        setDataInicio(parseISO(property.start_date));
        setDataFim(parseISO(property.end_date));

        const { data: currentTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('property_id', property.id)
          .single();

        if (currentTenant) {
          setTenantValue(currentTenant.id);
          setOriginalTenantId(currentTenant.id);
        }
      }

      const { data: allTenants } = await supabase.from('tenants').select('id, full_name');
      if (allTenants) {
        setTenantItems(allTenants.map(t => ({ label: t.full_name, value: t.id })));
      }
      setLoading(false);
    };
    fetchTenantsAndProperty();
  }, [property]);

  const handleUpdateProperty = async () => {
    setLoading(true);
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

    if (originalTenantId !== tenantValue) {
      if (originalTenantId) {
        await supabase.from('tenants').update({ property_id: null }).eq('id', originalTenantId);
      }
      if (tenantValue) {
        await supabase.from('tenants').update({ property_id: property.id }).eq('id', tenantValue);
      }
    }

    setLoading(false);
    Alert.alert('Success', 'Property updated successfully!');
    navigation.goBack();
  };
  
  const onDataInicioChange = (event, selectedDate) => {
    setShowDataInicioPicker(false);
    if (selectedDate) {
      setDataInicio(selectedDate);
    }
  };

  const onDataFimChange = (event, selectedDate) => {
    setShowDataFimPicker(false);
    if (selectedDate) {
      setDataFim(selectedDate);
    }
  };

  if (loading) {
      return <ActivityIndicator style={{flex: 1}} size="large" />
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Editar Propriedade</Text>
      
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Endereço</Text>
            <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} />
        </View>
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Propriedade</Text>
            <TextInput style={styles.input} value={tipoPropriedade} onChangeText={setTipoPropriedade} />
        </View>

        <View style={[styles.inputGroup, { zIndex: 1000 }]}>
            <Text style={styles.label}>Inquilino</Text>
            <DropDownPicker
                open={tenantOpen}
                value={tenantValue}
                items={tenantItems}
                setOpen={setTenantOpen}
                setValue={setTenantValue}
                setItems={setTenantItems}
                searchable={true}
                placeholder="Selecione um inquilino"
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

      {/* 2. Use the new CustomDatePicker component */}
      <CustomDatePicker
        date={dataInicio}
        onDateChange={onDataInicioChange}
        visible={showDataInicioPicker}
        onClose={() => setShowDataInicioPicker(false)}
      />
      <CustomDatePicker
        date={dataFim}
        onDateChange={onDataFimChange}
        visible={showDataFimPicker}
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
    updateButton: { backgroundColor: '#FF9800', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 40 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default EditPropertyScreen;

