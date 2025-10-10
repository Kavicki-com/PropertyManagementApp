// screens/AddTransactionScreen.js
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
  Platform,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker'; // Use the new dropdown picker
import { supabase } from '../lib/supabase';

const AddTransactionScreen = ({ navigation }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // State for Property Dropdown
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyValue, setPropertyValue] = useState(null);
  const [propertyItems, setPropertyItems] = useState([]);
  
  // State for Type Dropdown
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeValue, setTypeValue] = useState('income');
  const [typeItems, setTypeItems] = useState([
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
  ]);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address');
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        const formattedProperties = data.map(prop => ({
          label: prop.address,
          value: prop.id,
        }));
        setPropertyItems(formattedProperties);
      }
    };
    fetchProperties();
  }, []);

  const handleAddTransaction = async () => {
    if (!description || !amount || !propertyValue) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('finances').insert({
      user_id: user.id,
      property_id: propertyValue,
      description: description,
      amount: parseFloat(amount),
      type: typeValue,
      date: new Date().toISOString(),
    });

    if (error) {
      Alert.alert('Error adding transaction', error.message);
    } else {
      Alert.alert('Success', 'Transaction added successfully!');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <Text style={styles.header}>Adicionar Transação</Text>
        </View>
        <ScrollView 
            style={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
        >

        {/* Property Dropdown */}
        <View style={[styles.inputGroup, { zIndex: 2000 }]}>
            <Text style={styles.label}>Propriedade</Text>
            <DropDownPicker
                open={propertyOpen}
                value={propertyValue}
                items={propertyItems}
                setOpen={setPropertyOpen}
                setValue={setPropertyValue}
                setItems={setPropertyItems}
                searchable={true}
                placeholder="Select a property"
                listMode="MODAL"
                zIndex={2000}
            />
        </View>
        
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
            style={styles.input}
            placeholder="e.g., Rent Payment, Maintenance"
            value={description}
            onChangeText={setDescription}
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor ($)</Text>
            <TextInput
            style={styles.input}
            placeholder="e.g., 1200"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            />
        </View>

        {/* Type Dropdown */}
        <View style={[styles.inputGroup, { zIndex: 1000 }]}>
            <Text style={styles.label}>Tipo</Text>
            <DropDownPicker
                open={typeOpen}
                value={typeValue}
                items={typeItems}
                setOpen={setTypeOpen}
                setValue={setTypeValue}
                setItems={setTypeItems}
                listMode="MODAL"
                zIndex={1000}
            />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddTransaction} disabled={loading}>
            {loading ? (
            <ActivityIndicator color="white" />
            ) : (
            <Text style={styles.addButtonText}>Adicionar Transação</Text>
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

export default AddTransactionScreen;