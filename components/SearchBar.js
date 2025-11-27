import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii } from '../theme';

const SearchBar = ({
  value,
  onChangeText,
  placeholder,
  style,
  containerStyle,
  autoFocus = false,
}) => {
  const trimmed = (value || '').trim();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.wrapper}>
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
        {trimmed.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="search" size={18} color={colors.textSecondary} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fafafa',
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.textPrimary,
  },
});

export default SearchBar;


