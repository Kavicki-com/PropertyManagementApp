// screens/EditTenantScreen.js
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
import { format, parseISO, differenceInMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker'; // Import the custom component

const EditTenantScreen = ({ route, navigation }) => {
  const { tenant } = route.params;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractLength, setContractLength] = useState(0);

  // Property Dropdown state
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(null);
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    // Pre-fill form with tenant data
    if (tenant) {
      setFullName(tenant.full_name || '');
      setPhone(tenant.phone || '');
      setEmail(tenant.email || '');
      setRentAmount(tenant.rent_amount?.toString() || '');
      setDeposit(tenant.deposit?.toString() || '');
      setDueDate(tenant.due_date?.toString() || '');
      setStartDate(tenant.start_date ? parseISO(tenant.start_date) : new Date());
      setEndDate(tenant.end_date ? parseISO(tenant.end_date) : new Date());
      setPropertyId(tenant.property_id);
    }

    // Fetch available properties for the dropdown
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address, rent');
      if (error) {
        console.error("Error fetching properties:", error);
      } else {
        const formattedProperties = data.map(p => ({ 
            label: p.address, 
            value: p.id,
            rent: p.rent 
        }));
        setProperties(formattedProperties);
      }
    };
    fetchProperties();
  }, [tenant]);
  
    // Auto-fill rent amount when a property is selected
    useEffect(() => {
        if (propertyId) {
          const selectedProperty = properties.find(item => item.value === propertyId);
          if (selectedProperty && selectedProperty.rent) {
            setRentAmount(selectedProperty.rent.toString());
          }
        } else {
          setRentAmount(''); // Clear if no property is selected
        }
      }, [propertyId, properties]);
      
    // Calculate contract length whenever start or end dates change
    useEffect(() => {
        const months = differenceInMonths(endDate, startDate);
        setContractLength(months);
    }, [startDate, endDate]);

  const handleUpdateTenant = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('tenants')
      .update({
        full_name: fullName,
        phone: phone,
        email: email,
        rent_amount: parseInt(rentAmount, 10) || null,
        deposit: parseInt(deposit, 10) || null,
        due_date: parseInt(dueDate, 10) || null,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        property_id: propertyId,
        lease_term: contractLength,
      })
      .eq('id', tenant.id);

    if (error) {
      Alert.alert('Error updating tenant', error.message);
    } else {
      Alert.alert('Success', 'Tenant updated successfully!');
      navigation.goBack();
    }
    setLoading(false);
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <Text style={styles.header}>Editar Inquilino</Text>
        </View>
        <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            </View>
            
            <View style={[styles.inputGroup, Platform.OS === 'android' && { zIndex: 1000 }]}>
                <Text style={styles.label}>Propriedade</Text>
                <DropDownPicker
                    open={open}
                    value={propertyId}
                    items={properties}
                    setOpen={setOpen}
                    setValue={setPropertyId}
                    setItems={setProperties}
                    searchable={true}
                    placeholder="Selecione uma propriedade"
                    listMode="MODAL"
                    clearable={true}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Data de locação</Text>
                <View style={styles.dateRow}>
                <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowStartPicker(true)}
                >
                    <Text>{format(startDate, 'dd/MM/yyyy')}</Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>até</Text>
                <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowEndPicker(true)}
                >
                    <Text>{format(endDate, 'dd/MM/yyyy')}</Text>
                </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Duração do Contrato (meses)</Text>
                <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={`${contractLength} meses`}
                    editable={false}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Valor do Aluguel</Text>
                <TextInput
                style={styles.input}
                placeholder="Selecione uma propriedade para preencher"
                value={rentAmount}
                onChangeText={setRentAmount}
                keyboardType="decimal-pad"
                />
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Dia do Vencimento do Aluguel</Text>
                <TextInput 
                    style={styles.input} 
                    value={dueDate} 
                    onChangeText={setDueDate} 
                    keyboardType="numeric"
                    placeholder="Ex: 5"
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


            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTenant} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
            </TouchableOpacity>

            <CustomDatePicker
                visible={showStartPicker}
                date={startDate}
                onDateChange={onStartDateChange}
                onClose={() => setShowStartPicker(false)}
            />

            <CustomDatePicker
                visible={showEndPicker}
                date={endDate}
                onDateChange={onEndDateChange}
                onClose={() => setShowEndPicker(false)}
            />
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
    disabledInput: {
        backgroundColor: '#f5f5f5',
        color: '#666',
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
    updateButton: { 
        backgroundColor: '#FF9800', 
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

export default EditTenantScreen;