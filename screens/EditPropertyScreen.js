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

  useEffect(() => {
    if (property) {
      setEndereco(property.address);
      setTipoPropriedade(property.type);
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
  
  // ... (DateTimePicker change handlers are the same)

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Editar Propriedade</Text>
      {/* Form fields are the same as AddPropertyScreen, just with pre-filled values */}
      {/* ... (Your JSX form from AddPropertyScreen can be pasted here, but ensure the button calls handleUpdateProperty) */}
      <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProperty} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
      </TouchableOpacity>
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
  },
  updateButton: {
    backgroundColor: '#4CAF50', // Green for update
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
  // ... (Add all other styles from AddPropertyScreen.js here)
});

export default EditPropertyScreen;