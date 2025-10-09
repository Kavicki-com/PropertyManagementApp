import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker'; // 1. Import the custom component

const AddTenantScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([]);
  const [allProperties, setAllProperties] = useState([]);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address, rent');
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        setAllProperties(data);
        const formattedProperties = data.map(prop => ({
          label: prop.address,
          value: prop.id,
        }));
        setItems(formattedProperties);
      }
    };
    fetchProperties();
  }, []);

  const onPropertySelect = (selectedValue) => {
    setValue(selectedValue);
    const selectedProp = allProperties.find(p => p.id === selectedValue);
    if (selectedProp) {
      setRentAmount(selectedProp.rent ? selectedProp.rent.toString() : '');
    } else {
      setRentAmount('');
    }
  };

  const handleAddTenant = async () => {
    if (!value) {
      Alert.alert('Erro', 'Por favor, selecione uma propriedade.');
      return;
    }
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado para adicionar um inquilino.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('tenants').insert({
      user_id: user.id,
      property_id: value,
      full_name: fullName,
      phone: phone,
      email: email,
      rent_amount: parseInt(rentAmount, 10) || null,
      deposit: parseInt(deposit, 10) || null,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    if (error) {
      Alert.alert('Erro ao adicionar inquilino', error.message);
    } else {
      Alert.alert('Sucesso', 'Inquilino adicionado com sucesso!');
      navigation.goBack();
    }
    setLoading(false);
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <ScrollView 
        style={styles.container}
        keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Adicionar Inquilino</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput style={styles.input} placeholder="Digite o nome do inquilino" value={fullName} onChangeText={setFullName} />
      </View>

      <View style={[styles.inputGroup, { zIndex: 1000 }]}>
        <Text style={styles.label}>Propriedade</Text>
        <DropDownPicker
            open={open}
            value={value}
            items={items}
            setOpen={setOpen}
            setValue={onPropertySelect}
            setItems={setItems}
            searchable={true}
            placeholder="Selecione uma propriedade"
            listMode="MODAL"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Telefone</Text>
        <TextInput style={styles.input} placeholder="Digite o telefone do inquilino" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="Digite o email do inquilino" value={email} onChangeText={setEmail} keyboardType="email-address" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Data de locação</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
            <Text>{format(startDate, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>to</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
            <Text>{format(endDate, 'dd/MM/yyyy')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Valor do Aluguel</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          placeholder="Selecione uma propriedade para preencher"
          value={rentAmount}
          editable={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Depósito Caução</Text>
        <TextInput style={styles.input} placeholder="Insira o valor de depósito" value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" />
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddTenant} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.addButtonText}>Adicionar Inquilino</Text>}
      </TouchableOpacity>

      {/* 2. Use the new CustomDatePicker component */}
      <CustomDatePicker
        date={startDate}
        onDateChange={onStartDateChange}
        visible={showStartPicker}
        onClose={() => setShowStartPicker(false)}
      />
      <CustomDatePicker
        date={endDate}
        onDateChange={onEndDateChange}
        visible={showEndPicker}
        onClose={() => setShowEndPicker(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputGroup: { marginBottom: 20, zIndex: 0 },
    label: { marginBottom: 8, fontWeight: '500' },
    input: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16 },
    disabledInput: { backgroundColor: '#f0f0f0', color: '#888' },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateInput: { flex: 1, height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, justifyContent: 'center' },
    dateSeparator: { marginHorizontal: 10, color: '#666' },
    addButton: { backgroundColor: '#4a86e8', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 50 },
    addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default AddTenantScreen;

