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
import { filterOnlyLetters, filterOnlyNumbers } from '../lib/validation';
import { canAddTenant, getUserSubscription, getActiveTenantsCount, getRequiredPlan } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';

const AddTenantScreen = ({ route, navigation }) => {
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

  const handleAddTenant = async () => {
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

      const { error } = await supabase
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
        });

      if (error) {
        Alert.alert('Erro ao adicionar inquilino', error.message);
      } else {
        Alert.alert('Sucesso', 'Inquilino adicionado com sucesso!');
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
                <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
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
                style={styles.input}
                placeholder="Digite o nome do inquilino"
                value={fullName}
                onChangeText={(text) => setFullName(filterOnlyLetters(text))}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o CPF do inquilino"
                value={cpf}
                onChangeText={(text) => setCpf(filterOnlyNumbers(text))}
                keyboardType="numeric"
                maxLength={11}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>RG</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o RG do inquilino"
                value={rg}
                onChangeText={(text) => setRg(filterOnlyNumbers(text))}
                keyboardType="numeric"
                />
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
                <TextInput
                style={styles.input}
                placeholder="Ex: Solteiro, Casado"
                value={maritalStatus}
                onChangeText={(text) => setMaritalStatus(filterOnlyLetters(text))}
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
                style={styles.input}
                placeholder="Digite o telefone do inquilino"
                value={phone}
                onChangeText={(text) => setPhone(filterOnlyNumbers(text))}
                keyboardType="phone-pad"
                maxLength={11}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o email do inquilino"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                />
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAddTenant} disabled={loading}>
                {loading ? (
                <ActivityIndicator color="white" />
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    backButton: {
        padding: 5,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'left',
        flex: 1,
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
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 15,
        justifyContent: 'center',
    },
    dateSeparator: {
        marginHorizontal: 10,
        color: '#666',
    },
    addButton: {
        backgroundColor: '#4a86e8',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 50,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AddTenantScreen;