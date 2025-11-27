import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

const ScreenHeader = ({ title, onBack }) => {
  return (
    <View style={[styles.headerContainer, !onBack && styles.headerContainerNoBack]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.header, !onBack && styles.headerNoBack]}>{title}</Text>
      {onBack ? <View style={{ width: 24 }} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
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
  headerContainerNoBack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  backButton: {
    padding: 5,
  },
  header: {
    ...typography.screenTitle,
    textAlign: 'left',
    flex: 1,
  },
  headerNoBack: {
    flex: 0,
  },
});

export default ScreenHeader;



