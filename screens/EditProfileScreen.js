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
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, typography, radii } from '../theme';
import { validatePassword, getPasswordStrength } from '../lib/validation';
import { SelectList } from 'react-native-dropdown-select-list';

const EditProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [accountType, setAccountType] = useState(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  const isFocused = useIsFocused();

  // Formatação de CPF
  const formatCPF = (text) => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    }
    return text;
  };

  // Formatação de telefone
  const formatPhone = (text) => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 10) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else if (numbers.length <= 11) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    return text;
  };

  // Mapeia valores do frontend para valores aceitos pelo banco de dados
  const mapAccountTypeToDB = (frontendValue) => {
    const mapping = {
      'Pessoa Física': 'individual',  // Tentando valor em inglês
      'Empresa': 'company',
      'Assessoria': 'advisory',
    };
    const mapped = mapping[frontendValue];
    console.log('Mapeando account_type:', frontendValue, '->', mapped);
    return mapped || frontendValue;
  };

  // Mapeia valores do banco de dados para valores do frontend
  const mapAccountTypeFromDB = (dbValue) => {
    const mapping = {
      'individual': 'Pessoa Física',
      'pessoa_fisica': 'Pessoa Física',
      'pessoa_física': 'Pessoa Física',
      'Pessoa': 'Pessoa Física',
      'company': 'Empresa',
      'empresa': 'Empresa',
      'advisory': 'Assessoria',
      'assessoria': 'Assessoria',
    };
    return mapping[dbValue] || dbValue;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email);
        
        // Primeiro tenta buscar apenas os campos básicos que sabemos que existem
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .single();
        
        // Se a query básica funcionou, tenta buscar os campos novos (pode falhar se não existirem)
        if (!error && profile) {
          try {
            const { data: extendedProfile, error: extendedError } = await supabase
              .from('profiles')
              .select('cpf, rg, nationality, marital_status, profession, account_type')
              .eq('id', user.id)
              .single();
            
            // Se os campos novos existirem, mescla os dados
            if (!extendedError && extendedProfile) {
              profile = { ...profile, ...extendedProfile };
            }
          } catch (err) {
            // Se os campos novos não existirem, continua apenas com os básicos
            console.log('Campos novos não disponíveis ainda:', err);
          }
        }
        
        if (error) {
          console.error('Error fetching profile:', error);
          // Se houver erro crítico, mostra alerta apenas se não conseguir carregar nada
          if (!profile) {
            Alert.alert('Erro', 'Não foi possível carregar o perfil. Verifique sua conexão.');
          }
        }
        
        if (profile) {
          setFullName(profile.full_name || '');
          setPhone(profile.phone ? formatPhone(profile.phone) : '');
          setCpf(profile.cpf ? formatCPF(profile.cpf) : '');
          setRg(profile.rg || '');
          setNationality(profile.nationality || '');
          setMaritalStatus(profile.marital_status || '');
          setProfession(profile.profession || '');
          // Converte valor do banco para valor do frontend
          const accountTypeValue = profile.account_type ? mapAccountTypeFromDB(profile.account_type) : null;
          setAccountType(accountTypeValue);
        }
      }
      setLoading(false);
    };

    if(isFocused){
        fetchProfile();
    }
  }, [isFocused]);

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Update profile data in the 'profiles' table
    // Primeiro atualiza os campos básicos que sabemos que existem
    const basicUpdateData = {
      full_name: fullName,
      phone: phone.replace(/\D/g, ''),
      updated_at: new Date().toISOString(),
    };

    let { error: profileError } = await supabase
      .from('profiles')
      .update(basicUpdateData)
      .eq('id', user.id);

    // Se os campos básicos foram atualizados, tenta atualizar os novos campos
    if (!profileError) {
      const extendedUpdateData = {
        cpf: cpf.replace(/\D/g, ''),
        rg: rg,
        nationality: nationality,
        marital_status: maritalStatus,
        profession: profession,
        account_type: accountType ? mapAccountTypeToDB(accountType) : null,
      };

      // Tenta atualizar os campos novos (pode falhar se não existirem, mas não é crítico)
      const { error: extendedError } = await supabase
        .from('profiles')
        .update(extendedUpdateData)
        .eq('id', user.id);
      
      // Se os campos novos não existirem, apenas loga o erro mas não bloqueia
      if (extendedError) {
        console.log('Alguns campos novos não puderam ser atualizados (podem não existir ainda):', extendedError.message);
        // Avisa o usuário que alguns campos podem não ter sido salvos se as colunas não existirem
        if (extendedError.message && extendedError.message.includes('column')) {
          Alert.alert(
            'Aviso', 
            'Os dados básicos foram salvos, mas alguns campos novos não puderam ser atualizados. Execute o script SQL para adicionar as novas colunas.'
          );
        }
      }
    }

    if (profileError) {
      Alert.alert('Erro', profileError.message);
      setIsSaving(false);
      return;
    }

    // 2. Update Email if it has changed
    if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email });
        if (emailError) {
            Alert.alert('Erro ao atualizar email', emailError.message);
            setIsSaving(false);
            return;
        }
        Alert.alert('Sucesso', 'Verifique seu novo email para confirmar a alteração.');
    }

    // 3. Update Password if a new one is provided
    if (newPassword) {
      // Validação de senha com requisitos de segurança
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        Alert.alert('Erro', passwordValidation.errors.join('\n'));
        setIsSaving(false);
        return;
      }
      
      if (newPassword !== confirmPassword) {
        Alert.alert('Erro', 'As senhas não coincidem');
        setIsSaving(false);
        return;
      }
      
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        Alert.alert('Erro ao atualizar senha', passwordError.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Editar perfil" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informações pessoais</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Digite seu nome completo"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput
                  style={styles.input}
                  value={cpf}
                  onChangeText={(text) => setCpf(formatCPF(text))}
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  maxLength={14}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>RG</Text>
                <TextInput
                  style={styles.input}
                  value={rg}
                  onChangeText={setRg}
                  placeholder="Digite seu RG"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nacionalidade</Text>
                <TextInput
                  style={styles.input}
                  value={nationality}
                  onChangeText={setNationality}
                  placeholder="Ex: Brasileiro(a)"
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
                  value={profession}
                  onChangeText={setProfession}
                  placeholder="Ex: Engenheiro, Professora"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhone(text))}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Digite seu email"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo de Conta</Text>
                <View style={styles.radioContainer}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setAccountType('Pessoa Física')}
                  >
                    <View style={styles.radioButton}>
                      {accountType === 'Pessoa Física' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Pessoa Física</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setAccountType('Empresa')}
                  >
                    <View style={styles.radioButton}>
                      {accountType === 'Empresa' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Empresa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setAccountType('Assessoria')}
                  >
                    <View style={styles.radioButton}>
                      {accountType === 'Assessoria' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Assessoria</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alterar senha</Text>
              <Text style={styles.passwordHint}>
                Requisitos: mín. 8 caracteres + 1 caractere especial (!@#$...)
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Deixe em branco para não alterar"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                {/* Indicador de força da senha */}
                {newPassword.length > 0 && (
                  <View style={styles.passwordStrengthContainer}>
                    <View style={styles.passwordStrengthBar}>
                      <View
                        style={[
                          styles.passwordStrengthFill,
                          {
                            width: `${Math.min(100, (getPasswordStrength(newPassword).score / 8) * 100)}%`,
                            backgroundColor:
                              getPasswordStrength(newPassword).strength === 'weak'
                                ? '#F44336'
                                : getPasswordStrength(newPassword).strength === 'medium'
                                ? '#FF9800'
                                : '#4CAF50',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.passwordStrengthText,
                        {
                          color:
                            getPasswordStrength(newPassword).strength === 'weak'
                              ? '#F44336'
                              : getPasswordStrength(newPassword).strength === 'medium'
                              ? '#FF9800'
                              : '#4CAF50',
                        },
                      ]}
                    >
                      {getPasswordStrength(newPassword).label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Deixe em branco para não alterar"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdateProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.buttonText}>Salvar alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  formContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
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
    backgroundColor: colors.surface,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 50,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.button,
    fontSize: 16,
  },
  radioContainer: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    ...typography.body,
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    minHeight: 50,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: colors.surface,
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
});

export default EditProfileScreen;
