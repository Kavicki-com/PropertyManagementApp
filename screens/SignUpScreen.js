// screens/SignUpScreen.js
import React, { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatPhone } from "../lib/formatters";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, radii } from "../theme";
import Constants from "expo-constants";
import {
  isValidEmail,
  validatePassword,
  getPasswordStrength,
} from "../lib/validation";

const SignUpScreen = ({ navigation }) => {
  // Topo seguro real do aparelho, em vez do `paddingTop: 50` que estava no
  // StyleSheet: 20pt num iPhone SE, 59pt num com Dynamic Island.
  const insets = useSafeAreaInsets();

  // Cadastro enxuto: e-mail, senha e aceite dos termos. Nome, CPF, RG,
  // nacionalidade, estado civil, profissão, telefone e tipo de conta saíram
  // daqui — eram doze campos antes do primeiro segundo de valor, e cinco dos
  // nove usuários reais abandonaram sem criar um imóvel. Tudo isso é
  // preenchível depois em "Editar perfil".
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Nome é obrigatório";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Digite seu nome";
    }

    // Telefone é opcional. Só validamos se a pessoa começou a digitar — um
    // número pela metade é erro de digitação, campo vazio é uma escolha.
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      newErrors.phone = "Telefone incompleto. Use DDD + número";
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
    // CPF, RG, nacionalidade, estado civil, profissão, telefone e tipo de conta
    // saíram do cadastro: nada disso é necessário para o primeiro imóvel, e as
    // colunas aceitam NULL. O usuário preenche em "Editar perfil" quando fizer
    // diferença. O nome ficou: sem ele o app não tem como se dirigir à pessoa,
    // e a conta parece vazia já na primeira tela.
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

      // O cadastro grava só o que ele coleta: nome e e-mail. Os demais campos
      // têm DEFAULT na função e são preenchidos depois, em "Editar perfil" — o
      // upsert usa COALESCE, então uma edição posterior não apaga o que já
      // existe.
      const profileParams = {
        p_user_id: authData.user.id,
        p_full_name: fullName.trim(),
        p_phone: phone.replace(/\D/g, "") || null,
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

        // O cadastro não manda mais account_type, então a constraint
        // account_type_check deixou de ser alcançável por aqui.

        // Se a função não existir, tenta método alternativo
        if (
          functionError.message &&
          functionError.message.includes("function") &&
          functionError.message.includes("does not exist")
        ) {
          // Método alternativo: tenta inserir apenas campos básicos
          const basicProfileData = {
            id: authData.user.id,
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
            // Registra o aceite dos termos, que é o único dado além do login
            // que o cadastro coleta.
            try {
              const extendedData = {
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
      <View style={[styles.headerContainer, { paddingTop: insets.top + 15 }]}>
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
          <Text style={styles.sectionTitle}>Seus dados</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Como podemos te chamar"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errors.fullName) setErrors({ ...errors, fullName: null });
              }}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
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
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="(00) 00000-0000 — opcional"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhone(text));
                if (errors.phone) setErrors({ ...errors, phone: null });
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={15}
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
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
});

export default SignUpScreen;
