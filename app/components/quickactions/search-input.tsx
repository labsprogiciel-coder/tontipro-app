import React from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';

interface SearchInputProps {
    placeholder?: string;
    value: string;
    onChangeText: (text: string) => void;
    onFilterPress?: () => void;
}

const SearchInput: React.FC<SearchInputProps> = ({
    placeholder = "Rechercher un client...",
    value,
    onChangeText,
    onFilterPress
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.searchWrapper}>
                <Search
                    size={18}
                    color="#888780" // --color-text-tertiary
                    style={styles.searchIcon}
                />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#888780"
                    value={value}
                    onChangeText={onChangeText}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {/* Filter Button - Common in agent tools for sorting by locality or status */}
            <Pressable
                onPress={onFilterPress}
                style={({ pressed }) => [
                    styles.filterBtn,
                    pressed && styles.pressed
                ]}
            >
                <SlidersHorizontal size={18} color="#5f5e5a" />
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff', // --color-background-primary
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.1)', // --color-border-tertiary
        paddingHorizontal: 12,
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#1a1a18', // --color-text-primary
        height: '100%',
    },
    filterBtn: {
        width: 48,
        height: 48,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    pressed: {
        backgroundColor: '#f5f4f0', // --color-background-secondary
        opacity: 0.9,
    },
});

export default SearchInput;