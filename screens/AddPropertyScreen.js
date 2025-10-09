// screens/AddPropertyScreen.js
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
  Platform,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

const AddPropertyScreen = ({ navigation }) => {
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

  const handleAddProperty = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'You must be logged in to add a property.');
      setLoading(false);
      return;
    }
    
    const isRented = tenantId !== null;

    const { data: newProperty, error } = await supabase.from('properties').insert({
      user_id: user.id,
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
      // REMOVED rented: isRented
    }).select().single();

    if (error) {
      Alert.alert('Error adding property', error.message);
      setLoading(false);
      return;
    }

    if (isRented && newProperty) {
        const { error: tenantError } = await supabase
            .from('tenants')
            .update({ property_id: newProperty.id })
            .eq('id', tenantId);

        if (tenantError) {
            Alert.alert('Property created, but failed to associate tenant', tenantError.message);
        }
    }


    Alert.alert('Success', 'Property added successfully!');
    navigation.goBack();

    setLoading(false);
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

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Adicionar Propriedade</Text>

        <View style={[styles.inputGroup, { zIndex: 1000 }]}>
            <Text style={styles.label}>Inquilino Associado (Opcional)</Text>
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
        <TextInput
          style={styles.input}
          placeholder="Digite o endereço completo"
          value={endereco}
          onChangeText={setEndereco}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tipo de Propriedade</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Casa, Apartamento"
          value={tipoPropriedade}
          onChangeText={setTipoPropriedade}
        />
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Quartos</Text>
          <TextInput
            style={styles.input}
            placeholder="Número"
            value={quartos}
            onChangeText={setQuartos}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.inputGroupHalf}>
          <Text style={styles.label}>Banheiros</Text>
          <TextInput
            style={styles.input}
            placeholder="Número"
            value={banheiros}
            onChangeText={setBanheiros}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Área (m²)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 150"
          value={area}
          onChangeText={setArea}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tamanho do Lote</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 0.25 acres"
          value={tamanhoLote}
          onChangeText={setTamanhoLote}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Valor do Aluguel (R$)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 1800"
          value={aluguel}
          onChangeText={setAluguel}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prazo do Contrato (meses)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 12"
          value={prazoContrato}
          onChangeText={setPrazoContrato}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Datas do Contrato</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDataInicioPicker(true)}
          >
            <Text>{format(dataInicio, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>até</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDataFimPicker(true)}
          >
            <Text>{format(dataFim, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddProperty} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.addButtonText}>Adicionar Propriedade</Text>
        )}
      </TouchableOpacity>

      {showDataInicioPicker && (
        <DateTimePicker
          value={dataInicio}
          mode="date"
          display="default"
          onChange={onDataInicioChange}
        />
      )}

      {showDataFimPicker && (
        <DateTimePicker
          value={dataFim}
          mode="date"
          display="default"
          onChange={onDataFimChange}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      padding: 20,
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
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
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateInput: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 15,
      justifyContent: 'center',
      backgroundColor: '#f9f9f9',
    },
    dateSeparator: {
      marginHorizontal: 10,
      color: '#666',
    },
    addButton: {
      backgroundColor: '#4a86e8',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    addButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
  });


export default AddPropertyScreen;