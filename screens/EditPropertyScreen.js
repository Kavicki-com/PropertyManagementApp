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
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

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
  const [loading, setLoading] = useState(false);

  // Pre-fill the form with the property's data when the screen loads
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
      setDataInicio(parseISO(property.start_date));
      setDataFim(parseISO(property.end_date));
    }
  }, [property]);

  const handleUpdateProperty = async () => {
    setLoading(true);
    const { error } = await supabase
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

    if (error) {
      Alert.alert('Error updating property', error.message);
    } else {
      Alert.alert('Success', 'Property updated successfully!');
      navigation.goBack();
    }
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
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Editar Propriedade</Text>
      
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

        {/* ... other fields ... */}

      <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProperty} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
      </TouchableOpacity>

      {showDataInicioPicker && <DateTimePicker value={dataInicio} mode="date" display="default" onChange={onDataInicioChange} />}
      {showDataFimPicker && <DateTimePicker value={dataFim} mode="date" display="default" onChange={onDataFimChange} />}
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