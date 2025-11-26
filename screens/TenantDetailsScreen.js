// screens/TenantDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { fetchTenantBillingSummary } from '../lib/financesService';
import { fetchActiveContractByTenant, endContract } from '../lib/contractsService';
import { colors, radii, typography } from '../theme';

const TenantDetailsScreen = ({ route, navigation }) => {
  const { tenant: initialTenant } = route.params;
  
  const [tenant, setTenant] = useState(initialTenant);
  const [loading, setLoading] = useState(true);
  const [billingSummary, setBillingSummary] = useState({
    expected: 0,
    paid: 0,
    overdue: 0,
  });
  const [billingSchedule, setBillingSchedule] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!initialTenant?.id) return;

      setLoading(true);
      
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          *,
          properties (
            id,
            address,
            rent 
          )
        `)
        .eq('id', initialTenant.id)
        .single();

      if (tenantError) {
        setLoading(false);
        Alert.alert('Error', 'Could not fetch tenant details.');
        console.error('Error fetching details:', tenantError);
        return;
      }
      
      setTenant(tenantData);
      setLoading(false);
    };

    // Re-fetch data every time the screen comes into focus
    if (isFocused) {
      fetchDetails();
    }
  }, [isFocused, initialTenant?.id]);

  useEffect(() => {
    const loadContract = async () => {
      if (!tenant?.id) return;
      setContractLoading(true);
      try {
        const { data } = await fetchActiveContractByTenant(tenant.id);
        setContract(data || null);
      } finally {
        setContractLoading(false);
      }
    };

    loadContract();
  }, [tenant?.id, isFocused]);

  useEffect(() => {
    const loadBilling = async () => {
      // Se não há contrato ativo, não há mensalidades a exibir
      if (!contract) {
        setBillingSummary({ expected: 0, paid: 0, overdue: 0 });
        setBillingSchedule([]);
        return;
      }

      setBillingLoading(true);
      try {
        // Monta um objeto compatível com a função de billing atual,
        // usando os dados do contrato (e não mais do cadastro do inquilino)
        const source = {
          property_id: contract.property_id,
          tenant_id: contract.tenant_id,
          start_date: contract.start_date,
          due_date: contract.due_day,
          lease_term: contract.lease_term,
        };

        const { summary, schedule } = await fetchTenantBillingSummary(source);
        setBillingSummary(summary);
        setBillingSchedule(schedule);
      } finally {
        setBillingLoading(false);
      }
    };

    loadBilling();
  }, [contract, isFocused]);

  const handleDeleteTenant = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar este inquilino?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            // 1) Limpar lançamentos financeiros de aluguel (receitas) ligados a este inquilino
            const { error: financesError } = await supabase
              .from('finances')
              .delete()
              .eq('tenant_id', tenant.id)
              .eq('type', 'income');

            if (financesError) {
              console.error('Erro ao limpar lançamentos financeiros do inquilino:', financesError);
              Alert.alert(
                'Erro',
                'Não foi possível limpar os registros de pagamentos de aluguel deste inquilino. Tente novamente.'
              );
              return;
            }

            // 2) Deletar o inquilino (contratos são removidos automaticamente via ON DELETE CASCADE)
            const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar o inquilino.');
            } else {
              Alert.alert('Sucesso', 'Inquilino deletado e registros financeiros de aluguel limpos.');
              navigation.goBack();
            }
          },
          style: 'destructive' 
        }
      ]
    );
  };

  const handleEndTenancy = async () => {
    Alert.alert(
      'Encerrar locação',
      'Tem certeza que deseja encerrar a locação deste inquilino para este imóvel?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('tenants')
              .update({ property_id: null })
              .eq('id', tenant.id);

            if (error) {
              console.error('Erro ao encerrar locação pelo inquilino:', error);
              Alert.alert('Erro', 'Não foi possível encerrar a locação.');
              return;
            }

            // Encerrar contrato ativo associado, se existir
            if (contract?.id) {
              const { error: contractError } = await endContract(contract.id);
              if (contractError) {
                console.error('Erro ao encerrar contrato ativo:', contractError);
              }
            }

            Alert.alert('Sucesso', 'Locação encerrada e imóvel desvinculado.');
            setTenant((prev) => ({
              ...prev,
              property_id: null,
              properties: null,
            }));
            setContract(null);
          },
        },
      ]
    );
  };

  const handleRegisterRentPayment = () => {
    if (!tenant.property_id) return;
    navigation.navigate('AddTransaction', {
      preselectedPropertyId: tenant.property_id,
      preselectedType: 'income',
      preselectedTenantId: tenant.id,
    });
  };

  if (loading || !tenant) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  const handleOpenProperty = () => {
    if (!tenant.properties) return;
    navigation.navigate('PropertyDetails', { property: tenant.properties });
  };

  return (
    <View style={styles.container}>
        <ScreenHeader
          title={tenant.full_name}
          onBack={() => navigation.goBack()}
        />
        <ScrollView style={styles.scrollContainer}>
            <View style={styles.avatarContainer}>
                <Image 
                source={require('../assets/avatar-placeholder.png')} 
                style={styles.avatar} 
                />
            </View>
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dados do Inquilino</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nome completo</Text>
                    <Text style={styles.infoValue}>{tenant.full_name || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CPF</Text>
                    <Text style={styles.infoValue}>{tenant.cpf || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>RG</Text>
                    <Text style={styles.infoValue}>{tenant.rg || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nacionalidade</Text>
                    <Text style={styles.infoValue}>{tenant.nationality || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Estado civil</Text>
                    <Text style={styles.infoValue}>{tenant.marital_status || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Profissão</Text>
                    <Text style={styles.infoValue}>{tenant.profession || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Telefone</Text>
                    <Text style={styles.infoValue}>{tenant.phone || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{tenant.email || 'N/A'}</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contrato</Text>

                {/* Propriedade vinculada */}

                {tenant.properties ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleOpenProperty}
                  >
                    <View style={styles.contractPropertyCard}>
                      <View style={styles.contractPropertyInfo}>
                        <Text style={styles.contractPropertyAddress} numberOfLines={1} ellipsizeMode="tail">
                          {tenant.properties.address}
                        </Text>
                        <Text style={styles.contractPropertySub}>
                          R${tenant.properties.rent || 0}/mês
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.contractPropertyAction}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEndTenancy();
                        }}
                      >
                        <MaterialIcons name="close" size={16} color="#F44336" />
                        <Text style={styles.contractPropertyActionText}>Encerrar locação</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.contractPropertyEmpty}>
                    <Text style={styles.contractPropertyEmptyText}>
                      Nenhum imóvel alugado no momento
                    </Text>
                  </View>
                )}

                {/* Dados do contrato */}
                {contractLoading ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Contrato</Text>
                    <Text style={styles.infoValue}>Carregando...</Text>
                  </View>
                ) : contract ? (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Duração do Contrato</Text>
                      <Text style={styles.infoValue}>
                        {contract.lease_term != null ? `${contract.lease_term} meses` : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Vencimento</Text>
                      <Text style={styles.infoValue}>
                        {contract.due_day ? `Todo dia ${contract.due_day}` : 'N/A'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Contrato ativo</Text>
                    <Text style={styles.infoValue}>Nenhum contrato ativo</Text>
                  </View>
                )}

                {/* Resumo financeiro do contrato */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Faturas esperadas (contrato)</Text>
                  <Text style={styles.infoValue}>
                    {billingLoading ? '...' : billingSummary.expected}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Faturas registradas</Text>
                  <Text style={styles.infoValue}>
                    {billingLoading ? '...' : billingSummary.paid}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Em atraso</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      !billingLoading && billingSummary.overdue > 0 && { color: '#F44336', fontWeight: '600' },
                    ]}
                  >
                    {billingLoading ? '...' : billingSummary.overdue}
                  </Text>
                </View>

                {/* Linha do tempo simples das faturas */}
                {billingSchedule.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.timelineTitle}>Meses do contrato</Text>
                    <View style={styles.timelineContainer}>
                      {billingSchedule.map((item) => (
                        <View
                          key={item.monthIndex}
                          style={[
                            styles.timelinePill,
                            item.status === 'paid' && styles.timelinePillPaid,
                            item.status === 'overdue' && styles.timelinePillOverdue,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timelinePillText,
                              (item.status === 'paid' || item.status === 'overdue') &&
                                styles.timelinePillTextEmphasis,
                            ]}
                          >
                            {item.monthIndex}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.timelineLegend}>
                      <View style={styles.timelineLegendItem}>
                        <View style={[styles.legendDot, styles.legendDotPaid]} />
                        <Text style={styles.legendText}>Pago</Text>
                      </View>
                      <View style={styles.timelineLegendItem}>
                        <View style={[styles.legendDot, styles.legendDotOverdue]} />
                        <Text style={styles.legendText}>Em atraso</Text>
                      </View>
                      <View style={styles.timelineLegendItem}>
                        <View style={[styles.legendDot, styles.legendDotFuture]} />
                        <Text style={styles.legendText}>Futuro</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Ações de contrato */}
                <View style={styles.tenantActions}>
                  {tenant.properties && (
                    <TouchableOpacity
                      style={styles.primaryContractButton}
                      onPress={handleRegisterRentPayment}
                    >
                      <Text style={styles.primaryContractButtonText}>
                        Registrar pagamento de aluguel
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.primaryContractButton,
                      {
                        marginTop: tenant.properties ? 8 : 0,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#4a86e8',
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('AddContract', {
                        tenantId: tenant.id,
                        contract,
                        // Não passamos mais a propriedade; ela será escolhida na tela de contrato
                      })
                    }
                  >
                    <Text style={[styles.primaryContractButtonText, { color: '#4a86e8' }]}>
                      {contract ? 'Renovar / editar contrato' : 'Criar contrato'}
                    </Text>
                  </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditTenant', { tenant: tenant })}
                >
                  <Text style={styles.buttonText}>Editar Inquilino</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTenant}>
                  <Text style={[styles.buttonText, styles.deleteButtonText]}>Deletar Inquilino</Text>
                </TouchableOpacity>
            </View>
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
    loadingContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: colors.background,
    },
    avatarContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    avatar: { 
        width: 100, 
        height: 100, 
        borderRadius: 50, 
        marginBottom: 15,
    },
    section: { 
        backgroundColor: colors.surface, 
        borderRadius: radii.md, 
        padding: 15, 
        marginHorizontal: 15,
        marginTop: 20
    },
    sectionTitle: { 
        ...typography.sectionTitle,
        marginBottom: 15,
    },
    contractPropertyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0f7ff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    contractPropertyInfo: {
        flex: 1,
        marginRight: 8,
    },
    contractPropertyAddress: {
        ...typography.bodyStrong,
        marginBottom: 4,
    },
    contractPropertySub: {
        ...typography.body,
    },
    contractPropertyAction: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: '#ffebee',
    },
    contractPropertyActionText: {
        marginLeft: 4,
        fontSize: 12,
        color: '#F44336',
        fontWeight: '600',
    },
    contractPropertyEmpty: {
        borderRadius: 10,
        padding: 12,
        backgroundColor: '#f5f5f5',
        marginBottom: 12,
    },
    contractPropertyEmptyText: {
        fontSize: 14,
        color: '#777',
        fontStyle: 'italic',
    },
    infoRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingVertical: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee',
    },
    infoLabel: { 
        ...typography.body,
    },
    infoValue: { 
        ...typography.bodyStrong,
        flex: 1, 
        textAlign: 'right',
    },
    linkText: {
        color: '#4a86e8',
        textDecorationLine: 'underline',
    },
    buttonContainer: { 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: 15, 
        gap: 8,
        marginBottom: 20,
    },
    editButton: { 
        backgroundColor: colors.primary, 
        padding: 15, 
        borderRadius: radii.pill, 
        flex: 1,  
        alignItems: 'center',
    },
    deleteButton: { 
        backgroundColor: 'transparent', 
        padding: 15, 
        borderRadius: radii.pill, 
        flex: 1,  
        alignItems: 'center',
    },
    buttonText: { 
        ...typography.button,
        color: '#fff', 
    },
    deleteButtonText: {
        color: colors.expense,
    },
    tenantActions: {
        marginTop: 10,
    },
    tenantActionButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    tenantActionText: {
        ...typography.button,
        color: colors.primary,
    },
    primaryContractButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        backgroundColor: colors.primary,
        alignItems: 'center',
        marginTop: 10,
    },
    primaryContractButtonText: {
        ...typography.button,
        color: '#fff',
    },
    timelineTitle: {
        marginTop: 10,
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
    },
    timelineContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 4,
    },
    timelinePill: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fafafa',
    },
    timelinePillPaid: {
        backgroundColor: '#E8F5E9',
        borderColor: '#4CAF50',
    },
    timelinePillOverdue: {
        backgroundColor: '#FFEBEE',
        borderColor: '#F44336',
    },
    timelinePillText: {
        fontSize: 12,
        color: '#666',
    },
    timelinePillTextEmphasis: {
        fontWeight: '600',
        color: '#333',
    },
    timelineLegend: {
        flexDirection: 'row',
        marginTop: 8,
        justifyContent: 'space-between',
    },
    timelineLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 4,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    legendDotPaid: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    legendDotOverdue: {
        backgroundColor: '#F44336',
        borderColor: '#F44336',
    },
    legendDotFuture: {
        backgroundColor: '#ddd',
    },
    legendText: {
        fontSize: 11,
        color: '#555',
    },
});

export default TenantDetailsScreen;