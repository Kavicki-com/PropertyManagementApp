// screens/AddTenantScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { filterOnlyLetters, filterOnlyNumbers, isValidCPF, isValidEmail, isValidPhone } from '../lib/validation';
import { canAddTenant, getUserSubscription, getActiveTenantsCount, getRequiredPlan } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { SelectList } from 'react-native-dropdown-select-list';
import { removeCache, CACHE_KEYS } from '../lib/cacheService';

const AddTenantScreen = ({ route, navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { preselectedPropertyId } = route.params || {};
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Nome completo é obrigatório';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!isValidCPF(cpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os dígitos.';
    }

    if (!rg.trim()) {
      newErrors.rg = 'RG é obrigatório';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (!isValidPhone(phone)) {
      newErrors.phone = 'Telefone inválido. Use formato (00) 00000-0000';
    }

    if (email.trim() && !isValidEmail(email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTenant = async () => {
    if (!validate()) {
      Alert.alert('Verifique os dados', 'Alguns campos precisam de atenção antes de salvar.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (!user) {
        Alert.alert('Erro', 'Você precisa estar logado para adicionar um inquilino.');
        setLoading(false);
        return;
      }

      // Validar se pode adicionar inquilino
      const canAdd = await canAddTenant(user.id);
      if (!canAdd) {
        setLoading(false);
        const tenantCount = await getActiveTenantsCount(user.id);
        const subscription = await getUserSubscription(user.id);
        const currentPlan = subscription?.subscription_plan || 'free';
        // Se o plano atual é basic, sempre sugere premium
        const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(tenantCount + 1);

        setSubscriptionInfo({
          currentPlan,
          propertyCount: tenantCount,
          requiredPlan,
        });
        setShowUpgradeModal(true);
        return;
      }

      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert({
          user_id: user.id,
          full_name: fullName,
          cpf: cpf,
          rg: rg,
          nationality,
          marital_status: maritalStatus,
          profession,
          phone: phone,
          email: email,
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Erro ao adicionar inquilino', error.message);
      } else {
        // Se houver preselectedPropertyId, vincular automaticamente
        if (preselectedPropertyId && newTenant) {
          // Remover qualquer outro inquilino vinculado a esta propriedade
          await supabase
            .from('tenants')
            .update({ property_id: null })
            .eq('property_id', preselectedPropertyId)
            .neq('id', newTenant.id);

          // Vincular o novo inquilino
          const { error: linkError } = await supabase
            .from('tenants')
            .update({ property_id: preselectedPropertyId })
            .eq('id', newTenant.id);

          if (linkError) {
            Alert.alert('Aviso', 'Inquilino criado, mas não foi possível vincular à propriedade.');
          } else {
            Alert.alert('Sucesso', 'Inquilino adicionado e vinculado à propriedade com sucesso!');
          }

          // Invalidar cache de inquilinos e propriedades
          await Promise.all([
            removeCache(CACHE_KEYS.TENANTS),
            removeCache(CACHE_KEYS.PROPERTIES),
            removeCache(CACHE_KEYS.PROPERTY_DETAILS(preselectedPropertyId)),
            removeCache(CACHE_KEYS.DASHBOARD),
          ]);
        } else {
          // Invalidar apenas cache de inquilinos
          await removeCache(CACHE_KEYS.TENANTS);
          Alert.alert('Sucesso', 'Inquilino adicionado com sucesso!');
        }
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.header}>Adicionar Inquilino</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
      >
        <ScrollView
          style={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Digite o nome do inquilino"
              value={fullName}
              onChangeText={(text) => {
                setFullName(filterOnlyLetters(text));
                if (errors.fullName) setErrors({ ...errors, fullName: null });
              }}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CPF</Text>
            <TextInput
              style={[styles.input, errors.cpf && styles.inputError]}
              placeholder="Digite o CPF do inquilino"
              value={cpf}
              onChangeText={(text) => {
                setCpf(filterOnlyNumbers(text));
                if (errors.cpf) setErrors({ ...errors, cpf: null });
              }}
              keyboardType="numeric"
              maxLength={11}
            />
            {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>RG</Text>
            <TextInput
              style={[styles.input, errors.rg && styles.inputError]}
              placeholder="Digite o RG do inquilino"
              value={rg}
              onChangeText={(text) => {
                setRg(filterOnlyNumbers(text));
                if (errors.rg) setErrors({ ...errors, rg: null });
              }}
              keyboardType="numeric"
            />
            {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nacionalidade</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Brasileiro"
              value={nationality}
              onChangeText={(text) => setNationality(filterOnlyLetters(text))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estado civil</Text>
            <SelectList
              setSelected={(val) => setMaritalStatus(val)}
              data={[
                { key: 'Solteiro', value: 'Solteiro' },
                { key: 'Casado', value: 'Casado' },
                { key: 'União Estável', value: 'União Estável' },
                { key: 'Divorciado', value: 'Divorciado' },
              ]}
              save="value"
              placeholder="Selecione o estado civil"
              defaultOption={maritalStatus ? { key: maritalStatus, value: maritalStatus } : undefined}
              boxStyles={styles.dropdown}
              inputStyles={styles.dropdownText}
              dropdownStyles={styles.dropdownContainer}
              search={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Profissão</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Engenheiro, Professora"
              value={profession}
              onChangeText={(text) => setProfession(filterOnlyLetters(text))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="Digite o telefone do inquilino"
              value={phone}
              onChangeText={(text) => {
                setPhone(filterOnlyNumbers(text));
                if (errors.phone) setErrors({ ...errors, phone: null });
              }}
              keyboardType="phone-pad"
              maxLength={11}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Digite o email do inquilino"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: null });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAddTenant} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.addButtonText}>Adicionar Inquilino</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

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
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    padding: 5,
  },
  header: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    textAlign: 'left',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary, // Ensure label has color
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: 15,
    ...theme.typography.body,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 2,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 4,
    ...theme.typography.caption,
  },
  disabledInput: {
    backgroundColor: theme.colors.background, // or #f0f0f0 -> theme equivalent
    color: theme.colors.textSecondary,
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
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  dateSeparator: {
    marginHorizontal: 10,
    color: theme.colors.textSecondary,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 50,
  },
  addButtonText: {
    color: theme.colors.surface,
    ...theme.typography.button,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    minHeight: 50,
    overflow: 'hidden',
    width: '100%',
  },
  dropdownText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    ...theme.typography.body,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
});

export default AddTenantScreen;