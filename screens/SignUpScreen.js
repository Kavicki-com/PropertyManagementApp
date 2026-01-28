// screens/SignUpScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { supabase } from "../lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, radii } from "../theme";
import Constants from "expo-constants";
import {
  isValidCPF,
  isValidEmail,
  isValidPhone,
  validatePassword,
  getPasswordStrength,
  filterOnlyLetters,
  filterOnlyNumbers,
} from "../lib/validation";
import { SelectList } from "react-native-dropdown-select-list";

const SignUpScreen = ({ navigation }) => {
  // Dados básicos
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Novos campos
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [nationality, setNationality] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [profession, setProfession] = useState("");
  const [phone, setPhone] = useState("");

  // Tipo de conta
  const [accountType, setAccountType] = useState(null);

  // Termos
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Modal de informação do tipo de conta
  const [accountTypeInfoVisible, setAccountTypeInfoVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Formatação de CPF
  const formatCPF = (text) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 11) {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6)
        return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9)
        return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    }
    return text;
  };

  // Formatação de telefone
  const formatPhone = (text) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 10) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 6)
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else if (numbers.length <= 11) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7)
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    return text;
  };

  // Mapeia valores do frontend para valores aceitos pelo banco de dados
  // Tenta múltiplas variações possíveis
  const mapAccountTypeToDB = (frontendValue) => {
    // Primeira tentativa: valores em inglês (mais comum em constraints)
    const mappingEnglish = {
      "Pessoa Física": "individual",
      Empresa: "company",
      Assessoria: "advisory",
    };

    // Segunda tentativa: valores em português sem espaços
    const mappingPortuguese = {
      "Pessoa Física": "pessoa_fisica",
      Empresa: "empresa",
      Assessoria: "assessoria",
    };

    // Terceira tentativa: valores em português sem underscore
    const mappingPortugueseNoUnderscore = {
      "Pessoa Física": "pessoafisica",
      Empresa: "empresa",
      Assessoria: "assessoria",
    };

    // Por padrão, tenta inglês primeiro (mais comum)
    if (!frontendValue) {
      return null;
    }

    const mapped =
      mappingEnglish[frontendValue] ||
      mappingPortuguese[frontendValue] ||
      mappingPortugueseNoUnderscore[frontendValue] ||
      frontendValue;

    return mapped;
  };

  // Mapeia valores do banco de dados para valores do frontend
  const mapAccountTypeFromDB = (dbValue) => {
    const mapping = {
      individual: "Pessoa Física",
      pessoa_fisica: "Pessoa Física",
      pessoa_física: "Pessoa Física",
      Pessoa: "Pessoa Física",
      company: "Empresa",
      empresa: "Empresa",
      advisory: "Assessoria",
      assessoria: "Assessoria",
    };
    return mapping[dbValue] || dbValue;
  };

  const validate = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Nome completo é obrigatório";
    }
    if (!email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!isValidEmail(email)) {
      newErrors.email =
        "Email inválido. Verifique o formato (exemplo@dominio.com)";
    }

    // Validação de senha com requisitos de segurança
    if (!password) {
      newErrors.password = "Senha é obrigatória";
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.errors.join(". ");
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }
    // CPF é opcional, mas se preenchido deve ser válido
    if (cpf.trim() && !isValidCPF(cpf)) {
      newErrors.cpf = "CPF inválido. Verifique os dígitos.";
    }
    // RG, Nacionalidade, Estado Civil e Profissão são opcionais (sem validação)

    // Telefone é opcional, mas se preenchido deve ser válido
    if (phone.trim() && !isValidPhone(phone)) {
      newErrors.phone = "Telefone inválido. Use formato (00) 00000-0000";
    }
    if (!accountType) {
      newErrors.accountType = "Tipo de conta é obrigatório";
    }
    if (!termsAccepted) {
      newErrors.termsAccepted = "Você deve aceitar os termos de uso";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) {
      Alert.alert(
        "Erro de Validação",
        "Por favor, preencha todos os campos obrigatórios corretamente.",
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Criar conta de autenticação
      // Garantir que o email de confirmação seja enviado

      // Detecta se está rodando no Expo Go (desenvolvimento) ou em app nativo
      const isExpoGo = Constants.appOwnership === "expo";

      // Em desenvolvimento (Expo Go), tenta obter a URL dinamicamente
      let devRedirectUrl = "exp://10.0.1.118:8081/--/confirm-email";

      // Tenta obter o IP do dispositivo se disponível
      if (Constants.expoConfig?.hostUri) {
        const hostUri = Constants.expoConfig.hostUri;
        devRedirectUrl = `exp://${hostUri}/--/confirm-email`;
      } else if (Constants.manifest?.debuggerHost) {
        const debuggerHost = Constants.manifest.debuggerHost;
        devRedirectUrl = `exp://${debuggerHost}/--/confirm-email`;
      } else {
        // Fallback para IP comum em desenvolvimento local
        // O usuário pode precisar ajustar isso manualmente
        devRedirectUrl = "exp://localhost:8081/--/confirm-email";
      }

      // Em produção (app nativo / TestFlight), usamos o esquema llord:// registrado no app.
      const prodRedirectUrl = "llord://confirm-email";

      const redirectUrl = isExpoGo ? devRedirectUrl : prodRedirectUrl;

      // Logs de debug removidos por segurança (não expor informações sensíveis)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) {
        // Verifica se é erro de usuário já existente
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("User already registered") ||
          authError.message.includes("already exists") ||
          authError.message.includes("Email rate limit exceeded")
        ) {
          Alert.alert(
            "Email já cadastrado",
            "Este email já está cadastrado. Tente fazer login ou recuperar sua senha.",
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Fazer Login",
                onPress: () => navigation.navigate("Login"),
              },
              {
                text: "Recuperar Senha",
                onPress: () => navigation.navigate("ForgotPassword"),
              },
            ],
          );
        } else if (
          authError.message.includes("Invalid email") ||
          authError.message.includes("email")
        ) {
          Alert.alert(
            "Email inválido",
            "Por favor, verifique se o email está correto e tente novamente.",
          );
        } else if (authError.message.includes("Password")) {
          Alert.alert(
            "Erro na senha",
            "A senha não atende aos requisitos. Verifique se possui no mínimo 8 caracteres e pelo menos 1 caractere especial.",
          );
        } else if (
          authError.message.includes("network") ||
          authError.message.includes("Network")
        ) {
          Alert.alert(
            "Erro de conexão",
            "Verifique sua conexão com a internet e tente novamente.",
          );
        } else {
          Alert.alert(
            "Erro no cadastro",
            `Não foi possível criar a conta. ${authError.message || "Tente novamente mais tarde."}`,
          );
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        Alert.alert("Erro", "Não foi possível criar a conta. Tente novamente.");
        setLoading(false);
        return;
      }

      // Aguarda um pouco para garantir que a sessão está disponível
      // Isso é importante para que auth.uid() funcione nas políticas RLS
      // Logs de debug removidos por segurança (não expor dados sensíveis)

      // 2. Criar ou atualizar perfil com dados adicionais
      // Logs de debug removidos por segurança (não expor CPF, telefone, etc.)

      // 2. Criar perfil usando função do Supabase que bypassa RLS
      // Esta função usa SECURITY DEFINER para contornar problemas de RLS durante o cadastro

      // Mapeia account_type se existir
      const mappedAccountType = accountType
        ? mapAccountTypeToDB(accountType)
        : null;

      // Prepara os parâmetros da função
      const profileParams = {
        p_user_id: authData.user.id,
        p_full_name: fullName.trim(),
        p_phone: phone.trim() || null,
        p_cpf: cpf.trim() || null,
        p_rg: rg.trim() || null,
        p_nationality: nationality.trim() || null,
        p_marital_status: maritalStatus.trim() || null,
        p_profession: profession.trim() || null,
        p_account_type: mappedAccountType,
        p_terms_accepted: true,
        p_terms_accepted_at: new Date().toISOString(),
      };

      // Função auxiliar para verificar e exibir erro de perfil já existente
      const checkAndShowDuplicateProfileError = async (error, userId) => {
        if (!error || !error.message) {
          return false;
        }

        // Verifica a mensagem de erro original (sem toLowerCase para manter exatidão)
        const errorMessageOriginal = error.message;
        const errorMessage = errorMessageOriginal.toLowerCase();

        // Verifica múltiplas formas de detectar erro de foreign key relacionado a profiles
        // Mensagem exata que aparece: "insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey""
        const hasProfilesIdFkey = errorMessage.includes("profiles_id_fkey");
        const hasForeignKeyAndProfiles =
          errorMessage.includes("foreign key") &&
          errorMessage.includes("profiles");
        const hasInsertUpdateProfiles =
          errorMessage.includes("insert or update") &&
          errorMessage.includes("profiles");
        const isCode23503 = error.code === "23503";

        // Se qualquer uma dessas condições for verdadeira, é erro de foreign key em profiles
        const isForeignKeyError =
          hasProfilesIdFkey ||
          hasForeignKeyAndProfiles ||
          (hasInsertUpdateProfiles && errorMessage.includes("violates")) ||
          isCode23503;

        if (isForeignKeyError) {
          // Para erro de foreign key em profiles, sempre mostrar mensagem amigável
          // pois indica problema de vinculação (perfil duplicado ou usuário não existe em auth.users)
          Alert.alert(
            "Conta já cadastrada",
            "Este email já possui uma conta cadastrada. Por favor, faça login ou recupere sua senha.",
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Fazer Login",
                onPress: () => navigation.navigate("Login"),
              },
              {
                text: "Recuperar Senha",
                onPress: () => navigation.navigate("ForgotPassword"),
              },
            ],
          );
          setLoading(false);
          return true; // Indica que o erro foi tratado
        }
        return false; // Erro não foi tratado
      };

      const { error: functionError } = await supabase.rpc(
        "create_user_profile",
        profileParams,
      );

      if (functionError) {
        // Logs de erro mantidos apenas para debugging técnico (sem dados sensíveis)

        // PRIMEIRO: Verificação direta e simples para erro de foreign key em profiles
        // Verifica se a mensagem contém "profiles_id_fkey" (parte mais específica do erro)
        if (
          functionError.message &&
          (functionError.message.toLowerCase().includes("profiles_id_fkey") ||
            (functionError.message
              .toLowerCase()
              .includes("foreign key constraint") &&
              functionError.message.toLowerCase().includes("profiles")) ||
            functionError.code === "23503")
        ) {
          Alert.alert(
            "Conta já cadastrada",
            "Este email já possui uma conta cadastrada. Por favor, faça login ou recupere sua senha.",
            [
              {
                text: "Cancelar",
                style: "cancel",
              },
              {
                text: "Fazer Login",
                onPress: () => navigation.navigate("Login"),
              },
              {
                text: "Recuperar Senha",
                onPress: () => navigation.navigate("ForgotPassword"),
              },
            ],
          );
          setLoading(false);
          return;
        }

        // Verificar também usando a função auxiliar (para outros casos)
        const handled = await checkAndShowDuplicateProfileError(
          functionError,
          authData.user.id,
        );
        if (handled) {
          return;
        }

        // Se for erro de constraint de account_type, mostra mensagem específica
        if (
          functionError.code === "23514" &&
          functionError.message &&
          functionError.message.includes("account_type_check")
        ) {
          Alert.alert(
            "Erro no Tipo de Conta",
            "O valor do tipo de conta não é válido. Por favor, verifique a configuração do banco de dados.\n\nValor tentado: " +
            (accountType ? mapAccountTypeToDB(accountType) : "null") +
            "\n\nErro: " +
            functionError.message,
          );
          setLoading(false);
          return;
        }

        // Se a função não existir, tenta método alternativo
        if (
          functionError.message &&
          functionError.message.includes("function") &&
          functionError.message.includes("does not exist")
        ) {
          // Método alternativo: tenta inserir apenas campos básicos
          const basicProfileData = {
            id: authData.user.id,
            full_name: fullName,
            phone: phone.replace(/\D/g, ""),
          };

          const { error: basicError } = await supabase
            .from("profiles")
            .upsert(basicProfileData, { onConflict: "id" });

          if (basicError) {
            // Verificação direta para erro de foreign key em profiles
            if (
              basicError.message &&
              (basicError.message.toLowerCase().includes("profiles_id_fkey") ||
                (basicError.message
                  .toLowerCase()
                  .includes("foreign key constraint") &&
                  basicError.message.toLowerCase().includes("profiles")) ||
                basicError.code === "23503")
            ) {
              Alert.alert(
                "Conta já cadastrada",
                "Este email já possui uma conta cadastrada. Por favor, faça login ou recupere sua senha.",
                [
                  {
                    text: "Cancelar",
                    style: "cancel",
                  },
                  {
                    text: "Fazer Login",
                    onPress: () => navigation.navigate("Login"),
                  },
                  {
                    text: "Recuperar Senha",
                    onPress: () => navigation.navigate("ForgotPassword"),
                  },
                ],
              );
              setLoading(false);
              return;
            }

            // Verificar se é erro de perfil duplicado usando função auxiliar
            const handled = await checkAndShowDuplicateProfileError(
              basicError,
              authData.user.id,
            );
            if (!handled) {
              Alert.alert(
                "Aviso",
                "Conta criada com sucesso! Mas houve um problema ao salvar dados do perfil.\n\nExecute o script create_profile_function.sql no Supabase para resolver este problema.\n\nErro: " +
                basicError.message,
              );
            } else {
              return;
            }
          } else {
            // Tenta atualizar campos adicionais depois
            try {
              const extendedData = {
                cpf: cpf.replace(/\D/g, ""),
                rg: rg,
                nationality: nationality,
                marital_status: maritalStatus,
                profession: profession,
                account_type: accountType
                  ? mapAccountTypeToDB(accountType)
                  : null,
                terms_accepted: true,
                terms_accepted_at: new Date().toISOString(),
              };

              await supabase
                .from("profiles")
                .update(extendedData)
                .eq("id", authData.user.id);
            } catch (extendedErr) {
              // Erro silencioso - campos adicionais podem ser salvos depois
            }
          }
        } else {
          // Verificar se o perfil foi criado mesmo com erro
          const { data: profileCheck } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", authData.user.id)
            .single();

          if (profileCheck) {
            Alert.alert(
              "Aviso",
              "Conta criada com sucesso! Alguns dados do perfil podem não ter sido salvos completamente. Você pode completar seu perfil nas configurações.",
            );
          } else {
            // Verificação direta para erro de foreign key em profiles ANTES de mostrar mensagem genérica
            if (
              functionError.message &&
              (functionError.message
                .toLowerCase()
                .includes("profiles_id_fkey") ||
                (functionError.message
                  .toLowerCase()
                  .includes("foreign key constraint") &&
                  functionError.message.toLowerCase().includes("profiles")) ||
                functionError.code === "23503")
            ) {
              Alert.alert(
                "Conta já cadastrada",
                "Este email já possui uma conta cadastrada. Por favor, faça login ou recupere sua senha.",
                [
                  {
                    text: "Cancelar",
                    style: "cancel",
                  },
                  {
                    text: "Fazer Login",
                    onPress: () => navigation.navigate("Login"),
                  },
                  {
                    text: "Recuperar Senha",
                    onPress: () => navigation.navigate("ForgotPassword"),
                  },
                ],
              );
              setLoading(false);
              return;
            }

            // Verificar novamente se é erro de perfil duplicado usando função auxiliar
            const handled = await checkAndShowDuplicateProfileError(
              functionError,
              authData.user.id,
            );
            if (!handled) {
              Alert.alert(
                "Erro ao criar perfil",
                "Não foi possível criar seu perfil. Por favor, tente novamente ou entre em contato com o suporte.\n\nErro: " +
                functionError.message,
              );
              setLoading(false);
              return;
            }
          }
        }
      }

      if (authData.session) {
        // Se a sessão foi retornada, navegar para a tela principal
        // Isso acontece quando a confirmação de email está desabilitada
        Alert.alert("Sucesso", "Cadastro realizado com sucesso!");
        navigation.navigate("Main");
      } else {
        // Se confirmação de email é necessária (session é null quando email precisa ser confirmado)
        // O email de confirmação foi enviado automaticamente pelo Supabase
        Alert.alert(
          "Cadastro realizado!",
          "Por favor, verifique seu email para confirmar sua conta. O email pode levar alguns minutos para chegar. Verifique também a pasta de spam.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("Login"),
            },
            {
              text: "Reenviar email",
              onPress: async () => {
                const { error: resendError } = await supabase.auth.resend({
                  type: "signup",
                  email: email,
                });
                if (resendError) {
                  Alert.alert("Erro", resendError.message);
                } else {
                  Alert.alert("Sucesso", "Email de confirmação reenviado!");
                }
              },
            },
          ],
        );
        navigation.navigate("Login");
      }
    } catch (error) {
      Alert.alert("Erro", "Ocorreu um erro inesperado. Tente novamente.");
      console.error("Sign up error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Cadastre-se</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados de Acesso</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nome Completo *</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Digite seu nome completo"
              value={fullName}
              onChangeText={(text) => {
                setFullName(filterOnlyLetters(text));
                if (errors.fullName) setErrors({ ...errors, fullName: null });
              }}
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Digite seu email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: null });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha *</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="Mín. 8 caracteres + 1 especial (!@#$...)"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: null });
              }}
              secureTextEntry
            />
            {/* Indicador de força da senha */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.passwordStrengthBar}>
                  <View
                    style={[
                      styles.passwordStrengthFill,
                      {
                        width: `${Math.min(100, (getPasswordStrength(password).score / 8) * 100)}%`,
                        backgroundColor:
                          getPasswordStrength(password).strength === "weak"
                            ? "#F44336"
                            : getPasswordStrength(password).strength ===
                              "medium"
                              ? "#FF9800"
                              : "#4CAF50",
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.passwordStrengthText,
                    {
                      color:
                        getPasswordStrength(password).strength === "weak"
                          ? "#F44336"
                          : getPasswordStrength(password).strength === "medium"
                            ? "#FF9800"
                            : "#4CAF50",
                    },
                  ]}
                >
                  {getPasswordStrength(password).label}
                </Text>
              </View>
            )}
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmar Senha *</Text>
            <TextInput
              style={[
                styles.input,
                errors.confirmPassword && styles.inputError,
              ]}
              placeholder="Confirme sua senha"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: null });
              }}
              secureTextEntry
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>CPF</Text>
            <TextInput
              style={[styles.input, errors.cpf && styles.inputError]}
              placeholder="000.000.000-00"
              value={cpf}
              onChangeText={(text) => {
                setCpf(formatCPF(filterOnlyNumbers(text)));
                if (errors.cpf) setErrors({ ...errors, cpf: null });
              }}
              keyboardType="numeric"
              maxLength={14}
            />
            {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>RG</Text>
            <TextInput
              style={[styles.input, errors.rg && styles.inputError]}
              placeholder="Digite seu RG"
              value={rg}
              onChangeText={(text) => {
                setRg(filterOnlyNumbers(text));
                if (errors.rg) setErrors({ ...errors, rg: null });
              }}
              keyboardType="numeric"
            />
            {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nacionalidade</Text>
            <TextInput
              style={[styles.input, errors.nationality && styles.inputError]}
              placeholder="Ex: Brasileiro"
              value={nationality}
              onChangeText={(text) => {
                setNationality(filterOnlyLetters(text));
                if (errors.nationality)
                  setErrors({ ...errors, nationality: null });
              }}
            />
            {errors.nationality && (
              <Text style={styles.errorText}>{errors.nationality}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Estado Civil</Text>
            <SelectList
              setSelected={(val) => {
                setMaritalStatus(val);
                if (errors.maritalStatus)
                  setErrors({ ...errors, maritalStatus: null });
              }}
              data={[
                { key: "Solteiro", value: "Solteiro" },
                { key: "Casado", value: "Casado" },
                { key: "União Estável", value: "União Estável" },
                { key: "Divorciado", value: "Divorciado" },
              ]}
              save="value"
              placeholder="Selecione o estado civil"
              defaultOption={
                maritalStatus
                  ? { key: maritalStatus, value: maritalStatus }
                  : undefined
              }
              boxStyles={[
                styles.dropdown,
                errors.maritalStatus && styles.inputError,
              ]}
              inputStyles={styles.dropdownText}
              dropdownStyles={styles.dropdownContainer}
              search={false}
            />
            {errors.maritalStatus && (
              <Text style={styles.errorText}>{errors.maritalStatus}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Profissão</Text>
            <TextInput
              style={[styles.input, errors.profession && styles.inputError]}
              placeholder="Ex: Engenheiro, Professora"
              value={profession}
              onChangeText={(text) => {
                setProfession(filterOnlyLetters(text));
                if (errors.profession)
                  setErrors({ ...errors, profession: null });
              }}
            />
            {errors.profession && (
              <Text style={styles.errorText}>{errors.profession}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="(00) 00000-0000"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhone(filterOnlyNumbers(text)));
                if (errors.phone) setErrors({ ...errors, phone: null });
              }}
              keyboardType="phone-pad"
              maxLength={15}
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithIcon}>
              <Text style={styles.label}>Tipo de Conta *</Text>
              <TouchableOpacity
                onPress={() => setAccountTypeInfoVisible(true)}
                style={styles.infoIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons
                  name="info-outline"
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.radioContainer}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setAccountType("Pessoa Física");
                  if (errors.accountType)
                    setErrors({ ...errors, accountType: null });
                }}
              >
                <View style={styles.radioButton}>
                  {accountType === "Pessoa Física" && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={styles.radioLabel}>Pessoa Física</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setAccountType("Empresa");
                  if (errors.accountType)
                    setErrors({ ...errors, accountType: null });
                }}
              >
                <View style={styles.radioButton}>
                  {accountType === "Empresa" && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={styles.radioLabel}>Empresa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setAccountType("Assessoria");
                  if (errors.accountType)
                    setErrors({ ...errors, accountType: null });
                }}
              >
                <View style={styles.radioButton}>
                  {accountType === "Assessoria" && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={styles.radioLabel}>Assessoria</Text>
              </TouchableOpacity>
            </View>
            {errors.accountType && (
              <Text style={styles.errorText}>{errors.accountType}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                setTermsAccepted(!termsAccepted);
                if (errors.termsAccepted)
                  setErrors({ ...errors, termsAccepted: null });
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  termsAccepted && styles.checkboxChecked,
                ]}
              >
                {termsAccepted && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </View>
              <Text style={styles.termsText}>
                Eu aceito os{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate("TermsOfService")}
                >
                  Termos de Uso
                </Text>{" "}
                do aplicativo *
              </Text>
            </TouchableOpacity>
            {errors.termsAccepted && (
              <Text style={styles.errorText}>{errors.termsAccepted}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.signUpButtonText}>Cadastrar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Já tem uma conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.signInLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Informação do Tipo de Conta */}
      <Modal
        visible={accountTypeInfoVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAccountTypeInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialIcons
                name="info-outline"
                size={32}
                color={colors.primary}
              />
              <Text style={styles.modalTitle}>Tipo de Conta</Text>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
                O tipo de conta é apenas uma informação para entender melhor as suas preferências.
              </Text>

              <View style={styles.accountTypeList}>
                <View style={styles.accountTypeItem}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.accountTypeItemText}>
                    <Text style={styles.accountTypeItemTitle}>
                      Pessoa Física:{" "}
                    </Text>
                    Ideal para proprietários individuais
                  </Text>
                </View>

                <View style={styles.accountTypeItem}>
                  <MaterialIcons
                    name="business"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.accountTypeItemText}>
                    <Text style={styles.accountTypeItemTitle}>Empresa: </Text>
                    Para imobiliárias e empresas
                  </Text>
                </View>

                <View style={styles.accountTypeItem}>
                  <MaterialIcons
                    name="apartment"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.accountTypeItemText}>
                    <Text style={styles.accountTypeItemTitle}>
                      Assessoria:{" "}
                    </Text>
                    Para prestadores de serviços
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setAccountTypeInfoVisible(false)}
            >
              <Text style={styles.modalButtonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    paddingTop: 50,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 16,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  passwordStrengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
    marginRight: 10,
  },
  passwordStrengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 50,
  },
  termsContainer: {
    marginTop: 8,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  signUpButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.pill,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    ...typography.button,
    fontSize: 16,
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  signInText: {
    ...typography.body,
  },
  signInLink: {
    color: colors.primary,
    fontWeight: "bold",
  },
  radioContainer: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
    overflow: "hidden",
    width: "100%",
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
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoIcon: {
    marginLeft: 6,
    marginBottom: 4,
  },
  infoIconInline: {
    paddingHorizontal: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  modalTitle: {
    ...typography.screenTitle,
    fontSize: 22,
    flex: 1,
  },
  modalContent: {
    marginBottom: 20,
  },
  modalText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    color: colors.textSecondary,
  },
  accountTypeList: {
    gap: 12,
  },
  accountTypeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
  },
  accountTypeItemText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: colors.textSecondary,
  },
  accountTypeItemTitle: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  modalButtonText: {
    ...typography.button,
    color: colors.surface,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SignUpScreen;
