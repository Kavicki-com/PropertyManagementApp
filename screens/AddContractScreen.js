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
  KeyboardAvoidingView,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { format, differenceInMonths } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker';
import { createContract } from '../lib/contractsService';
import { colors, radii, typography } from '../theme';

const AddContractScreen = ({ route, navigation }) => {
  const { tenantId, contract: existingContract, property } = route.params || {};

  const [propertyId, setPropertyId] = useState(property?.id || existingContract?.property_id || null);
  const [properties, setProperties] = useState([]);

  const [rentAmount, setRentAmount] = useState(
    existingContract?.rent_amount != null ? String(existingContract.rent_amount) : '',
  );
  const [deposit, setDeposit] = useState(
    existingContract?.deposit != null ? String(existingContract.deposit) : '',
  );
  const [dueDate, setDueDate] = useState(
    existingContract?.due_day != null ? String(existingContract.due_day) : '',
  );
  const [startDate, setStartDate] = useState(
    existingContract?.start_date ? new Date(existingContract.start_date) : new Date(),
  );
  const [endDate, setEndDate] = useState(
    existingContract?.end_date ? new Date(existingContract.end_date) : new Date(),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [contractLength, setContractLength] = useState(existingContract?.lease_term || 0);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, rent')
        .is('archived_at', null);

      if (error) {
        Alert.alert('Erro', 'Não foi possível carregar as propriedades.');
      } else {
        const formatted = (data || []).map((p) => ({
          label: p.address,
          value: p.id,
          rent: p.rent,
        }));
        setProperties(formatted);

        // Se não houver propertyId inicial, usar a primeira disponível
        if (!propertyId && formatted.length > 0) {
          setPropertyId(formatted[0].value);
          if (formatted[0].rent) {
            setRentAmount(String(formatted[0].rent));
          }
        }
      }
    };

    fetchProperties();
  }, []);

  useEffect(() => {
    if (propertyId && (!existingContract || !existingContract.rent_amount)) {
      const selected = properties.find((item) => item.value === propertyId);
      if (selected && selected.rent) {
        setRentAmount(String(selected.rent));
      }
    }
  }, [propertyId, properties, existingContract]);

  useEffect(() => {
    const months = differenceInMonths(endDate, startDate);
    setContractLength(months);
  }, [startDate, endDate]);

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

  const handleSaveContract = async () => {
    if (!tenantId) {
      Alert.alert('Erro', 'Inquilino não informado para o contrato.');
      return;
    }

    if (!propertyId) {
      Alert.alert('Erro', 'Selecione uma propriedade para o contrato.');
      return;
    }

    if (!rentAmount) {
      Alert.alert('Erro', 'Informe o valor do aluguel.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await createContract({
        tenantId,
        propertyId,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        dueDay: dueDate ? parseInt(dueDate, 10) : null,
        rentAmount: rentAmount ? parseInt(rentAmount, 10) : null,
        deposit: deposit ? parseInt(deposit, 10) : null,
        leaseTerm: contractLength,
      });

      if (error) {
        Alert.alert('Erro ao salvar contrato', error.message || 'Tente novamente.');
        return;
      }

      const actionLabel = existingContract ? 'atualizado' : 'criado';
      Alert.alert('Sucesso', `Contrato ${actionLabel} com sucesso!`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!existingContract;

  return (
  <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>
          {isEditing ? 'Editar / renovar contrato' : 'Criar contrato de locação'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
      >
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
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
            zIndex={1000}
          />
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
            placeholder="Ex: 1800"
            value={rentAmount}
            onChangeText={(text) => setRentAmount(text.replace(/[^0-9]/g, ''))}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dia do Vencimento do Aluguel</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 5"
            value={dueDate}
            onChangeText={(text) => setDueDate(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Depósito Caução</Text>
          <TextInput
            style={styles.input}
            placeholder="Insira o valor de depósito"
            value={deposit}
            onChangeText={(text) => setDeposit(text.replace(/[^0-9]/g, ''))}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveContract}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Salvar contrato' : 'Criar contrato'}
            </Text>
          )}
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
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    padding: 5,
  },
  header: {
    ...typography.sectionTitle,
    textAlign: 'left',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
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
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  dateSeparator: {
    marginHorizontal: 10,
    color: '#666',
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    ...typography.button,
  },
});

export default AddContractScreen;


