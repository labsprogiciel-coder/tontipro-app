import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KAURIDORR_THEME } from '@/constants/colors';

const T = KAURIDORR_THEME;

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ placeholder, value, onChangeText }) => (
  <View style={styles.container}>
    <Feather name="search" size={16} color={T.text3} />
    <TextInput 
      style={styles.input}
      placeholder={placeholder || "Rechercher..."}
      placeholderTextColor={T.text3}
      value={value}
      onChangeText={onChangeText}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: T.bg2, 
    marginHorizontal: 18, 
    marginVertical: 10,
    paddingHorizontal: 12, 
    borderRadius: 12, 
    height: 44,
    borderWidth: 0.5,
    borderColor: T.border 
  },
  input: { flex: 1, marginLeft: 8, fontSize: 14, color: T.text1 },
});

export default SearchBar;