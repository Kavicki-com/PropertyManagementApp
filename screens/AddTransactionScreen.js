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
import { SelectList } from 'react-native-dropdown-select-list';
import { supabase } from '../lib/supabase';
import { fetchActiveContractByProperty } from '../lib/contractsService';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii, typography } from '../theme';
import { canAddFinancialTransaction, getUserSubscription, getActivePropertiesCount, getRequiredPlan } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';

const AddTransactionScreen = ({ route, navigation }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [discounts, setDiscounts] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [rentAmount, setRentAmount] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  const preselectedPropertyId = route?.params?.preselectedPropertyId ?? null;
  const preselectedTenantId = route?.params?.preselectedTenantId ?? null;
  // Modo aluguel apenas quando há propriedade pré-selecionada E veio da tela de detalhes do inquilino
  const isRentMode = !!preselectedPropertyId && !!preselectedTenantId;
  const [propertyValue, setPropertyValue] = useState(preselectedPropertyId || null);
  const [propertyItems, setPropertyItems] = useState([]);
  
  // Determinar tipo inicial: se está no modo aluguel, usar 'rent', senão usar o tipo pré-selecionado ou 'income'
  const preselectedType = route?.params?.preselectedType ?? (isRentMode ? 'rent' : 'income');
  // Garantir que o tipo inicial seja válido (se não estiver no modo aluguel, não pode ser 'rent')
  const initialType = (isRentMode && preselectedType === 'rent') ? 'rent' : (preselectedType === 'rent' ? 'income' : preselectedType);
  const [typeValue, setTypeValue] = useState(initialType);
  
  // Opção "Aluguel" só aparece quando veio da tela de detalhes do inquilino
  const [typeItems] = useState(() => {
    const baseItems = [
      { key: 'income', value: 'Entrada' },
      { key: 'expense', value: 'Despesa' },
    ];
    // Adicionar "Aluguel" apenas se veio da tela de detalhes do inquilino
    if (preselectedTenantId) {
      baseItems.push({ key: 'rent', value: 'Aluguel' });
    }
    return baseItems;
  });

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address')
        .is('archived_at', null);
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        const formattedProperties = data.map(prop => ({
          key: prop.id,
          value: prop.address,
        }));
        setPropertyItems(formattedProperties);
        
        // Se há propriedade pré-selecionada, buscar o endereço
        if (preselectedPropertyId) {
          const selectedProperty = data.find(p => p.id === preselectedPropertyId);
          if (selectedProperty) {
            setPropertyAddress(selectedProperty.address);
          }
        }
      }
    };
    fetchProperties();
  }, [preselectedPropertyId]);

  // Buscar valor do aluguel quando houver propriedade pré-selecionada
  useEffect(() => {
    const fetchRentAmount = async () => {
      if (!preselectedPropertyId) return;
      
      const { data: activeContract, error: contractError } =
        await fetchActiveContractByProperty(preselectedPropertyId);

      if (contractError) {
        console.error('Erro ao buscar contrato ativo:', contractError);
        Alert.alert('Aviso', 'Não foi possível carregar o valor do aluguel. Verifique se há um contrato ativo para esta propriedade.');
      } else if (activeContract?.rent_amount) {
        // Garantir que o valor seja salvo como número ou string numérica
        const rentValue = activeContract.rent_amount;
        setRentAmount(rentValue.toString());
        // O valor inicial será ajustado automaticamente pelo useEffect quando discounts mudar
      } else {
        Alert.alert('Aviso', 'Não foi encontrado um contrato ativo com valor de aluguel para esta propriedade.');
      }
    };
    
    if (preselectedPropertyId) {
      fetchRentAmount();
    }
  }, [preselectedPropertyId]);

  // Calcular valor final quando descontos ou valor do aluguel mudarem
  useEffect(() => {
    if (isRentMode && rentAmount) {
      // Converter rentAmount para número (pode vir como string)
      const rent = typeof rentAmount === 'string' 
        ? parseFloat(rentAmount.replace(',', '.')) || 0
        : parseFloat(rentAmount) || 0;
      
      // Converter discounts para número (pode estar vazio ou com vírgula)
      const discountStr = (discounts || '').trim().replace(',', '.');
      const discount = discountStr ? (parseFloat(discountStr) || 0) : 0;
      
      // Calcular valor final: aluguel - descontos
      const finalAmount = Math.max(0, rent - discount);
      setAmount(finalAmount.toFixed(2));
    }
  }, [rentAmount, discounts, isRentMode]);

  const handleAddTransaction = async () => {
    // Validações diferentes para modo aluguel e modo normal
    if (isRentMode) {
      if (!propertyValue || !rentAmount) {
        Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
        return;
      }
    } else {
      if (!description || !amount || !propertyValue) {
        Alert.alert('Erro', 'Por favor, preencha todos os campos.');
        return;
      }
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      setLoading(false);
      return;
    }

    // Validar se pode adicionar lançamento financeiro
    const canAdd = await canAddFinancialTransaction(user.id);
    if (!canAdd) {
      setLoading(false);
      const propertyCount = await getActivePropertiesCount(user.id);
      const subscription = await getUserSubscription(user.id);
      const currentPlan = subscription?.subscription_plan || 'free';
      // Se o plano atual é basic, sempre sugere premium
      const requiredPlan = currentPlan === 'basic' ? 'premium' : 'basic';
      
      setSubscriptionInfo({
        currentPlan,
        propertyCount,
        requiredPlan,
      });
      setShowUpgradeModal(true);
      return;
    }

    // Descobrir tenant_id a ser usado (se vier da tela do inquilino já temos,
    // senão, para tipo "Aluguel", buscamos o contrato ativo do imóvel)
    let tenantIdForInsert = preselectedTenantId ?? null;

    // Buscar tenant_id apenas no modo aluguel
    if (!tenantIdForInsert && isRentMode) {
      const { data: activeContract, error: contractError } =
        await fetchActiveContractByProperty(propertyValue || null);

      if (contractError) {
        console.error('Erro ao buscar contrato ativo para lançamento de aluguel:', contractError);
      } else if (activeContract?.tenant_id) {
        tenantIdForInsert = activeContract.tenant_id;
      }
    }

    // Converter tipo "rent" para "income" no banco, mas apenas se estiver no modo aluguel
    const dbType = (isRentMode && typeValue === 'rent') ? 'income' : typeValue;
    const finalDescription = isRentMode 
      ? (description || 'Aluguel')
      : (description || (typeValue === 'rent' ? 'Aluguel' : ''));

    // Calcular valor final (aluguel - descontos) para modo aluguel
    // IMPORTANTE: Sempre calcular diretamente do rentAmount e discounts para garantir precisão
    // NUNCA usar o estado 'amount' no modo aluguel, pois ele pode estar desatualizado
    let finalAmount;
    if (isRentMode) {
      if (!rentAmount) {
        Alert.alert('Erro', 'Não foi possível obter o valor do aluguel. Por favor, tente novamente.');
        setLoading(false);
        return;
      }
      
      // Converter rentAmount para número (pode vir como string do banco)
      const rent = typeof rentAmount === 'string' 
        ? parseFloat(rentAmount.replace(',', '.')) || 0
        : parseFloat(rentAmount) || 0;
      
      if (rent <= 0) {
        Alert.alert('Erro', 'O valor do aluguel não é válido.');
        setLoading(false);
        return;
      }
      
      // Converter discounts para número (pode estar vazio ou com vírgula)
      const discountStr = (discounts || '').trim().replace(',', '.');
      const discount = discountStr ? (parseFloat(discountStr) || 0) : 0;
      
      // Calcular valor final: aluguel - descontos
      // Este é o valor que será salvo no banco de dados
      finalAmount = Math.max(0, rent - discount);
      
      // Validação final: garantir que o valor seja válido
      if (isNaN(finalAmount)) {
        Alert.alert('Erro', 'Erro ao calcular o valor final. Por favor, verifique os valores informados.');
        setLoading(false);
        return;
      }
    } else {
      // Modo normal: usar o valor digitado diretamente
      finalAmount = parseFloat(amount) || 0;
    }

    const { error } = await supabase.from('finances').insert({
      user_id: user.id,
      property_id: propertyValue || null,
      tenant_id: tenantIdForInsert,
      description: finalDescription,
      amount: finalAmount,
      type: dbType,
      date: new Date().toISOString(),
    });

    if (error) {
      Alert.alert('Erro ao adicionar transação', error.message);
    } else {
      Alert.alert('Sucesso', 'Transação adicionada com sucesso!');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.header}>Adicionar Transação</Text>
            <View style={{ width: 24 }} />
        </View>
        <ScrollView 
            style={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
        >

        {/* Property - Fixo apenas no modo aluguel (quando veio da tela de detalhes do inquilino) */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Propriedade</Text>
            {isRentMode ? (
                <View style={[styles.input, styles.disabledInput]}>
                    <Text style={styles.disabledText}>{propertyAddress || 'Carregando...'}</Text>
                </View>
            ) : (
                <SelectList
                    setSelected={(val) => setPropertyValue(val)}
                    data={propertyItems}
                    save="key"
                    placeholder="Selecione uma propriedade"
                    defaultOption={propertyValue ? propertyItems.find(p => p.key === propertyValue) : undefined}
                    boxStyles={styles.dropdown}
                    inputStyles={styles.dropdownText}
                    dropdownStyles={styles.dropdownContainer}
                    search={false}
                />
            )}
        </View>

        {isRentMode ? (
            <>
                {/* Descrição */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Descrição</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: Aluguel mensal"
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                {/* Valor do Aluguel - Fixo */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Valor do Aluguel (R$)</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                        <Text style={styles.disabledText}>
                            {rentAmount ? `R$ ${parseFloat(rentAmount).toFixed(2).replace('.', ',')}` : 'Carregando...'}
                        </Text>
                    </View>
                </View>

                {/* Descontos */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Descontos (R$)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: 50,00"
                        value={discounts}
                        onChangeText={setDiscounts}
                        keyboardType="numeric"
                    />
                </View>

                {/* Valor Final (calculado) - apenas visualização */}
                {rentAmount && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valor Final (R$)</Text>
                        <View style={[styles.input, styles.disabledInput]}>
                            <Text style={[styles.disabledText, styles.finalAmountText]}>
                                R$ {(() => {
                                    const rent = parseFloat(rentAmount) || 0;
                                    const discount = parseFloat(discounts) || 0;
                                    const final = Math.max(0, rent - discount);
                                    return final.toFixed(2).replace('.', ',');
                                })()}
                            </Text>
                        </View>
                    </View>
                )}
            </>
        ) : (
            <>
                {/* Tipo Dropdown - apenas quando não é modo aluguel */}
                {!isRentMode && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Tipo</Text>
                        <SelectList
                            setSelected={(val) => {
                                // Garantir que 'rent' só pode ser selecionado no modo aluguel
                                if (val === 'rent' && !isRentMode) {
                                    setTypeValue('income');
                                } else {
                                    setTypeValue(val);
                                }
                            }}
                            data={typeItems}
                            save="key"
                            placeholder="Selecione o tipo"
                            defaultOption={typeValue ? typeItems.find(t => t.key === typeValue) : undefined}
                            boxStyles={styles.dropdown}
                            inputStyles={styles.dropdownText}
                            dropdownStyles={styles.dropdownContainer}
                            search={false}
                        />
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Descrição</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: Aluguel, Reforma, Manutenção"
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Valor (R$)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: 1200"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                    />
                </View>
            </>
        )}

        <TouchableOpacity style={styles.addButton} onPress={handleAddTransaction} disabled={loading}>
            {loading ? (
            <ActivityIndicator color="white" />
            ) : (
            <Text style={styles.addButtonText}>Adicionar Transação</Text>
            )}
        </TouchableOpacity>
        </ScrollView>

        <UpgradeModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            navigation.navigate('Subscription');
          }}
          currentPlan={subscriptionInfo?.currentPlan || 'free'}
          propertyCount={subscriptionInfo?.propertyCount || 0}
          requiredPlan={subscriptionInfo?.requiredPlan || 'basic'}
          customMessage="O plano Gratuito não permite lançamentos financeiros. Faça upgrade para o plano Básico ou Premium para registrar recebimentos e despesas."
        />
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
  addButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: 'white',
    ...typography.button,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    minHeight: 50,
    overflow: 'hidden',
  },
  dropdownText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  disabledInput: {
    backgroundColor: colors.borderSubtle + '20',
    justifyContent: 'center',
  },
  disabledText: {
    color: colors.textSecondary || colors.textPrimary,
    fontSize: 16,
  },
  finalAmountText: {
    fontWeight: 'bold',
    color: colors.primary,
  },
});

export default AddTransactionScreen;