// components/PrivacyPolicyModal.js
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, radii } from '../theme';

/**
 * Modal que exibe a Política de Privacidade do aplicativo.
 * Usado na tela de assinaturas para não abrir links externos.
 */
const PrivacyPolicyModal = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Política de Privacidade</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.lastUpdated}>
                        Última atualização: {new Date().toLocaleDateString('pt-BR')}
                    </Text>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>1. Introdução</Text>
                        <Text style={styles.text}>
                            Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nosso aplicativo de gestão de propriedades. Ao usar o aplicativo, você concorda com as práticas descritas nesta política.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. Informações que Coletamos</Text>
                        <Text style={styles.text}>
                            Coletamos as seguintes categorias de informações:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dados de cadastro: nome, email, CPF, RG, telefone, profissão e nacionalidade
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dados de propriedades: endereços, valores de aluguel, informações de inquilinos
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dados financeiros: transações, recibos e histórico de pagamentos
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dados de uso: como você interage com o aplicativo
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Dados de assinatura: plano contratado, histórico de compras
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>3. Como Usamos suas Informações</Text>
                        <Text style={styles.text}>
                            Utilizamos suas informações para:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Fornecer e manter os serviços do aplicativo
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Processar transações e gerenciar sua assinatura
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Enviar notificações importantes sobre sua conta
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Melhorar nossos serviços e experiência do usuário
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Cumprir obrigações legais e regulatórias
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. Armazenamento e Segurança</Text>
                        <Text style={styles.text}>
                            Seus dados são armazenados em servidores seguros utilizando criptografia e outras medidas de segurança padrão da indústria. Utilizamos o Supabase como provedor de infraestrutura, que mantém certificações de segurança reconhecidas internacionalmente.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>5. Compartilhamento de Dados</Text>
                        <Text style={styles.text}>
                            Não vendemos suas informações pessoais. Podemos compartilhar dados apenas nas seguintes situações:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Com provedores de serviços que nos ajudam a operar o aplicativo
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Quando exigido por lei ou ordem judicial
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Para proteger nossos direitos legais
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Com seu consentimento explícito
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>6. Seus Direitos (LGPD)</Text>
                        <Text style={styles.text}>
                            De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Acessar seus dados pessoais
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Corrigir dados incompletos, inexatos ou desatualizados
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Solicitar a exclusão de seus dados
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Revogar seu consentimento
                        </Text>
                        <Text style={styles.bulletPoint}>
                            • Solicitar a portabilidade de seus dados
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>7. Retenção de Dados</Text>
                        <Text style={styles.text}>
                            Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para fornecer nossos serviços. Após encerramento da conta, podemos reter certos dados conforme exigido por lei ou para fins legítimos de negócio.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>8. Cookies e Tecnologias Similares</Text>
                        <Text style={styles.text}>
                            O aplicativo pode usar tecnologias de armazenamento local para melhorar sua experiência, como salvar preferências e manter você conectado. Essas informações são armazenadas apenas no seu dispositivo.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>9. Alterações nesta Política</Text>
                        <Text style={styles.text}>
                            Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações significativas através do aplicativo ou por email. O uso continuado do aplicativo após as alterações constitui sua aceitação da nova política.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>10. Contato</Text>
                        <Text style={styles.text}>
                            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato conosco através dos canais de suporte disponíveis no aplicativo ou pelo email de contato informado nas configurações.
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Ao utilizar o aplicativo, você confirma que leu e compreendeu esta Política de Privacidade.
                        </Text>
                    </View>
                </ScrollView>

                <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
                    <Text style={styles.confirmButtonText}>Entendi</Text>
                </TouchableOpacity>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        ...typography.sectionTitle,
        fontSize: 18,
    },
    closeButton: {
        padding: 4,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 32,
    },
    lastUpdated: {
        ...typography.caption,
        marginBottom: 20,
        textAlign: 'center',
        color: colors.textMuted,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        ...typography.sectionTitle,
        marginBottom: 12,
        fontSize: 16,
    },
    text: {
        ...typography.body,
        marginBottom: 12,
        lineHeight: 22,
    },
    bulletPoint: {
        ...typography.body,
        marginLeft: 16,
        marginBottom: 8,
        lineHeight: 22,
    },
    footer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.md,
        marginBottom: 20,
    },
    footerText: {
        ...typography.bodyStrong,
        textAlign: 'center',
        color: colors.primary,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        margin: 16,
        paddingVertical: 14,
        borderRadius: radii.pill,
        alignItems: 'center',
    },
    confirmButtonText: {
        ...typography.button,
        color: '#fff',
    },
});

export default PrivacyPolicyModal;
