// screens/AddTenantScreen.js
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
  Picker, // Import Picker
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

const AddTenantScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // State for properties dropdown
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Fetch properties when the component mounts
  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address');
      if (error) {
        console.error('Error fetching properties:', error);
      } else {
        setProperties(data);
      }
    };
    fetchProperties();
  }, []);

  const handleAddTenant = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado para adicionar um inquilino.');
      setLoading(false);
      return;
    }

    if (!selectedProperty) {
        Alert.alert('Erro', 'Por favor, selecione uma propriedade.');
        setLoading(false);
        return;
    }

    const { error } = await supabase.from('tenants').insert({
      user_id: user.id,
      property_id: selectedProperty,
      full_name: fullName,
      phone: phone,
      email: email,
      id_number: idNumber,
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
    setStartDate(selectedDate || startDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    setEndDate(selectedDate || endDate);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Adicionar Inquilino</Text>

      {/* --- Form fields --- */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite o nome do inquilino"
          value={fullName}
          onChangeText={setFullName}
        />
      </View>

      <View style={styles.inputGroup}>
          <Text style={styles.label}>Propriedade</Text>
          <View style={styles.pickerContainer}>
            <Picker
                selectedValue={selectedProperty}
                style={styles.picker}
                onValueChange={(itemValue) => setSelectedProperty(itemValue)}
            >
                <Picker.Item label="Selecione uma propriedade..." value={null} />
                {properties.map((prop) => (
                <Picker.Item key={prop.id} label={prop.address} value={prop.id} />
                ))}
            </Picker>
          </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Telefone</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite o telefone do inquilino"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite o email do inquilino"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Número de Identificação</Text>
        <TextInput
          style={styles.input}
          placeholder="Atribua um número ao inquilino"
          value={idNumber}
          onChangeText={setIdNumber}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Data de locação</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowStartPicker(true)}
          >
            <Text>{format(startDate, 'MM/dd/yyyy')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>to</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndPicker(true)}
          >
            <Text>{format(endDate, 'MM/dd/yyyy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Valor do Aluguel</Text>
        <TextInput
          style={styles.input}
          placeholder="Insira o valor do aluguel"
          value={rentAmount}
          onChangeText={setRentAmount}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Depósito Caução</Text>
        <TextInput
          style={styles.input}
          placeholder="Insira o valor de depósito"
          value={deposit}
          onChangeText={setDeposit}
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddTenant} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.addButtonText}>Adicionar Inquilino</Text>
        )}
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={onStartDateChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={onEndDateChange}
        />
      )}
    </ScrollView>
  );
};

// ... Your existing styles, plus a new style for the picker
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
      },
      inputGroup: {
        marginBottom: 20,
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
      pickerContainer: {
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        justifyContent: 'center',
      },
      picker: {
        height: 50,
        width: '100%',
      },
});

export default AddTenantScreen;