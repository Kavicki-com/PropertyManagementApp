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
  Dimensions,
} from 'react-native';
import { SelectList } from 'react-native-dropdown-select-list';
import { format, differenceInMonths } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker';
import { createContract, fetchActiveContractByProperty } from '../lib/contractsService';
import { parseMoney, filterOnlyNumbers, filterMoney } from '../lib/validation';
import { colors, radii, typography } from '../theme';

const AddContractScreen = ({ route, navigation }) => {
  const { tenantId, propertyId: preselectedPropertyId, contract: existingContract, property } = route.params || {};
  const screenWidth = Dimensions.get('window').width;

  const [propertyId, setPropertyId] = useState(
    preselectedPropertyId || property?.id || existingContract?.property_id || null
  );
  const [properties, setProperties] = useState([]);

  const [rentAmount, setRentAmount] = useState(
    existingContract?.rent_amount != null ? String(Math.round(existingContract.rent_amount * 100)) : '',
  );
  const [deposit, setDeposit] = useState(
    existingContract?.deposit != null ? String(Math.round(existingContract.deposit * 100)) : '',
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
  const [propertyWarning, setPropertyWarning] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      // Buscar todas as propriedades
      const { data: allProperties, error } = await supabase
        .from('properties')
        .select('id, address, rent')
        .is('archived_at', null);

      if (error) {
        Alert.alert('Erro', 'Não foi possível carregar as propriedades.');
        return;
      }

      // Se estiver editando um contrato existente, incluir a propriedade do contrato mesmo que esteja alugada
      const currentPropertyId = existingContract?.property_id || propertyId;
      
      // Filtrar propriedades que não têm contratos ativos (exceto a propriedade do contrato atual se estiver editando)
      const availableProperties = [];
      for (const prop of (allProperties || [])) {
        // Se for a propriedade do contrato atual em edição, sempre incluir
        if (currentPropertyId && prop.id === currentPropertyId) {
          availableProperties.push(prop);
        } else {
          // Verificar se tem contrato ativo
          const { data: activeContract } = await fetchActiveContractByProperty(prop.id);
          // Incluir apenas se não tiver contrato ativo
          if (!activeContract) {
            availableProperties.push(prop);
          }
        }
      }

      const formatted = availableProperties.map((p) => ({
        key: p.id,
        value: p.address,
        rent: p.rent,
      }));
      setProperties(formatted);

      // Se não houver propertyId inicial, usar a primeira disponível
      if (!propertyId && formatted.length > 0) {
        setPropertyId(formatted[0].key);
        if (formatted[0].rent) {
          setRentAmount(String(Math.round(formatted[0].rent * 100)));
        }
      }
    };

    fetchProperties();
  }, [existingContract]);

  useEffect(() => {
    if (propertyId && properties.length > 0) {
      const selected = properties.find((item) => item.key === propertyId);
      if (selected && selected.rent) {
        setRentAmount(String(Math.round(selected.rent * 100)));
      }
      
      // Verificar se o imóvel já está alugado (apenas se não for edição do mesmo contrato)
      const checkPropertyAvailability = async () => {
        if (!existingContract || existingContract.property_id !== propertyId) {
          const { data: activeContract } = await fetchActiveContractByProperty(propertyId);
          if (activeContract && activeContract.tenant_id !== tenantId) {
            // Buscar nome do inquilino atual
            const { data: currentTenant } = await supabase
              .from('tenants')
              .select('full_name')
              .eq('id', activeContract.tenant_id)
              .single();
            
            const tenantName = currentTenant?.full_name || 'outro inquilino';
            setPropertyWarning(`Este imóvel já está alugado para ${tenantName}. É necessário encerrar o contrato atual antes de criar um novo.`);
          } else {
            setPropertyWarning(null);
          }
        } else {
          setPropertyWarning(null);
        }
      };
      
      checkPropertyAvailability();
    }
  }, [propertyId, properties, tenantId, existingContract]);

  useEffect(() => {
    const months = differenceInMonths(endDate, startDate);
    setContractLength(months);
  }, [startDate, endDate]);

  // Função para formatar valor monetário durante a digitação
  const formatMoneyInput = (text) => {
    // Remove tudo exceto números
    const numbers = text.replace(/\D/g, '');
    
    if (!numbers) return '';
    
    // Converte para número e divide por 100 para ter centavos
    const value = parseFloat(numbers) / 100;
    
    // Formata como R$ 0,00
    return `R$ ${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
        propertyId: propertyId || null,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        dueDay: dueDate ? parseInt(dueDate, 10) : null,
        rentAmount: rentAmount ? (parseFloat(rentAmount) / 100) : null,
        deposit: deposit ? (parseFloat(deposit) / 100) : null,
        leaseTerm: contractLength,
      });

      if (error) {
        Alert.alert('Erro ao salvar contrato', error.message || 'Tente novamente.');
        return;
      }

      const actionLabel = existingContract ? 'atualizado' : 'criado';
      Alert.alert('Sucesso', `Contrato ${actionLabel} com sucesso!`);
      
      // Se veio da rota da home (tem tenantId pré-selecionado e não é edição), navegar para detalhes do inquilino
      if (tenantId && !existingContract) {
        // Buscar dados do inquilino para navegar
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .single();

        if (!tenantError && tenantData) {
          // Navegar para detalhes do inquilino
          navigation.replace('TenantDetails', { tenant: tenantData });
        } else {
          navigation.goBack();
        }
      } else {
        navigation.goBack();
      }
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
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Propriedade</Text>
          <SelectList
            setSelected={(val) => {
              setPropertyId(val);
              setPropertyWarning(null); // Limpar aviso ao mudar seleção
              const selected = properties.find(p => p.key === val);
              if (selected && selected.rent) {
                setRentAmount(String(Math.round(selected.rent * 100)));
              }
            }}
            data={properties}
            save="key"
            placeholder="Selecione uma propriedade"
            defaultOption={propertyId ? properties.find(p => p.key === propertyId) : undefined}
            boxStyles={styles.dropdown}
            inputStyles={styles.dropdownText}
            dropdownStyles={styles.dropdownContainer}
            search={false}
          />
          {propertyWarning && (
            <View style={styles.warningContainer}>
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningText}>{propertyWarning}</Text>
            </View>
          )}
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
            placeholder="R$ 0,00"
            value={rentAmount ? formatMoneyInput(rentAmount) : ''}
            onChangeText={(text) => {
              const numbers = text.replace(/\D/g, '');
              setRentAmount(numbers);
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dia do Vencimento do Aluguel</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 5"
            value={dueDate}
            onChangeText={(text) => setDueDate(filterOnlyNumbers(text))}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Depósito Caução</Text>
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            value={deposit ? formatMoneyInput(deposit) : ''}
            onChangeText={(text) => {
              const numbers = text.replace(/\D/g, '');
              setDeposit(numbers);
            }}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveContract}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
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
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
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
  dropdown: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    minHeight: 50,
    overflow: 'hidden',
    width: '100%',
    flexShrink: 1,
  },
  dropdownText: {
    fontSize: 16,
    color: colors.textPrimary,
    flexShrink: 1,
    maxWidth: '100%',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: '#92400E',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default AddContractScreen;


