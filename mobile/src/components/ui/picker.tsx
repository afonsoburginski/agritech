import { Icon } from '@/components/ui/icon';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS, CORNERS, FONT_SIZE, HEIGHT } from '@/theme/globals';
import { ChevronDown, LucideProps } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  TextInput,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

export interface PickerOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface PickerSection {
  title?: string;
  options: PickerOption[];
}

interface PickerProps {
  options?: PickerOption[];
  sections?: PickerSection[];
  value?: string;
  placeholder?: string;
  error?: string;
  variant?: 'outline' | 'filled' | 'group';
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  style?: ViewStyle;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;

  // Styling props
  label?: string;
  icon?: React.ComponentType<LucideProps>;
  rightComponent?: React.ReactNode | (() => React.ReactNode);
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;

  // Modal props
  modalTitle?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function Picker({
  options = [],
  sections = [],
  value,
  values = [],
  error,
  variant = 'filled',
  placeholder = 'Select an option...',
  onValueChange,
  onValuesChange,
  disabled = false,
  style,
  multiple = false,
  label,
  icon,
  rightComponent,
  inputStyle,
  labelStyle,
  errorStyle,
  modalTitle,
  searchable = false,
  searchPlaceholder = 'Search options...',
}: PickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Move ALL theme color hooks to the top level
  const borderColor = useColor({}, 'border');
  const text = useColor({}, 'text');
  const muted = useColor({}, 'mutedForeground');
  const cardColor = useColor({}, 'card');
  const danger = useColor({}, 'red');
  const accent = useColor({}, 'accent');
  const primary = useColor({}, 'primary');
  const primaryForeground = useColor({}, 'primaryForeground');
  const input = useColor({}, 'input');
  const mutedBg = useColor({}, 'muted');
  const textMutedColor = useColor({}, 'textMuted');

  // Normalize data structure - convert options to sections format
  const normalizedSections: PickerSection[] =
    sections.length > 0 ? sections : [{ options }];

  // Filter sections based on search query
  const filteredSections =
    searchable && searchQuery
      ? normalizedSections
          .map((section) => ({
            ...section,
            options: section.options.filter((option) =>
              option.label.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          }))
          .filter((section) => section.options.length > 0)
      : normalizedSections;

  // Get selected options for display
  const getSelectedOptions = () => {
    const allOptions = normalizedSections.flatMap((section) => section.options);

    if (multiple) {
      return allOptions.filter((option) => values.includes(option.value));
    } else {
      return allOptions.filter((option) => option.value === value);
    }
  };

  const selectedOptions = getSelectedOptions();

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const newValues = values.includes(optionValue)
        ? values.filter((v) => v !== optionValue)
        : [...values, optionValue];
      onValuesChange?.(newValues);
    } else {
      onValueChange?.(optionValue);
      setIsOpen(false);
    }
  };

  const getDisplayText = () => {
    if (selectedOptions.length === 0) return placeholder;

    if (multiple) {
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      }
      return `${selectedOptions.length} selected`;
    }

    return selectedOptions[0]?.label || placeholder;
  };

  const triggerStyle: ViewStyle = {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: variant === 'group' ? 0 : 16,
    paddingVertical: variant === 'group' ? 0 : 0,
    borderWidth: variant === 'group' ? 0 : 1,
    borderColor: error 
      ? danger 
      : variant === 'outline' 
        ? borderColor 
        : 'transparent',
    borderRadius: CORNERS,
    backgroundColor: variant === 'filled' ? cardColor : 'transparent',
    minHeight: variant === 'group' ? 'auto' : HEIGHT,
    opacity: disabled ? 0.5 : 1,
    gap: 12,
  };

  const renderOption = (
    option: PickerOption,
    sectionIndex: number,
    optionIndex: number
  ) => {
    const isSelected = multiple
      ? values.includes(option.value)
      : value === option.value;

    return (
      <TouchableOpacity
        key={`${sectionIndex}-${option.value}`}
        onPress={() => !option.disabled && handleSelect(option.value)}
        activeOpacity={0.7}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: CORNERS,
          backgroundColor: isSelected ? primary : 'transparent',
          marginVertical: 3,
          alignItems: 'flex-start',
          opacity: option.disabled ? 0.4 : 1,
        }}
        disabled={option.disabled}
      >
        <View
          style={{
            width: '100%',
            alignItems: 'flex-start',
          }}
        >
          <Text
            style={{
              color: isSelected ? primaryForeground : text,
              fontWeight: isSelected ? '600' : '400',
              fontSize: FONT_SIZE,
              lineHeight: 22,
            }}
          >
            {option.label}
          </Text>
          {option.description && (
            <Text
              variant='caption'
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 18,
                color: isSelected ? primaryForeground + 'CC' : textMutedColor,
              }}
            >
              {option.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[triggerStyle, style]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {/* Icon & Label */}
        {label && (
          <View
            style={{
              minWidth: 100,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
            pointerEvents='none'
          >
            {icon && (
              <Icon name={icon} size={18} color={error ? danger : muted} />
            )}
            <Text
              variant='caption'
              numberOfLines={1}
              ellipsizeMode='tail'
              style={[
                {
                  color: error ? danger : muted,
                  fontSize: 13,
                  fontWeight: '500',
                },
                labelStyle,
              ]}
              pointerEvents='none'
            >
              {label}
            </Text>
          </View>
        )}
        
        {!label && icon && (
          <Icon name={icon} size={18} color={error ? danger : muted} />
        )}

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text
            style={[
              {
                fontSize: FONT_SIZE,
                fontWeight: selectedOptions.length > 0 ? '400' : '400',
                color:
                  selectedOptions.length > 0
                    ? text
                    : disabled
                    ? muted
                    : error
                    ? danger
                    : muted,
                flex: 1,
              },
              inputStyle,
            ]}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {getDisplayText()}
          </Text>

          {rightComponent ? (
            typeof rightComponent === 'function' ? (
              rightComponent()
            ) : (
              rightComponent
            )
          ) : (
            <ChevronDown
              size={20}
              color={error ? danger : muted}
              style={{
                transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
                marginLeft: 4,
              }}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Error message */}
      {error && (
        <Text
          variant='caption'
          style={[
            {
              color: danger,
              marginTop: 6,
              marginLeft: 4,
              fontSize: 13,
            },
            errorStyle,
          ]}
        >
          {error}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType='fade'
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: cardColor,
              borderTopStartRadius: BORDER_RADIUS,
              borderTopEndRadius: BORDER_RADIUS,
              maxHeight: '75%',
              width: '100%',
              paddingBottom: 24,
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(modalTitle || multiple) && (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text 
                  variant='title'
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: text,
                  }}
                >
                  {modalTitle || 'Selecionar Opções'}
                </Text>

                {multiple && (
                  <TouchableOpacity 
                    onPress={() => setIsOpen(false)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        color: primary,
                        fontWeight: '600',
                        fontSize: FONT_SIZE,
                      }}
                    >
                      Concluir
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Search */}
            {searchable && (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                }}
              >
                <TextInput
                  style={{
                    height: 44,
                    paddingHorizontal: 16,
                    borderRadius: CORNERS,
                    backgroundColor: input,
                    color: text,
                    fontSize: FONT_SIZE,
                    borderWidth: 1,
                    borderColor: borderColor,
                  }}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            )}

            {/* Options - Updated to match date-picker styling */}
            <View style={{ maxHeight: 400 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  paddingBottom: 24,
                }}
              >
                {filteredSections.map((section, sectionIndex) => (
                  <View key={sectionIndex} style={{ marginBottom: section.title ? 16 : 0 }}>
                    {section.title && (
                      <View
                        style={{
                          paddingHorizontal: 4,
                          paddingVertical: 10,
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          variant='caption'
                          style={{
                            fontWeight: '600',
                            color: textMutedColor,
                            fontSize: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                          }}
                        >
                          {section.title}
                        </Text>
                      </View>
                    )}
                    {section.options.map((option, optionIndex) =>
                      renderOption(option, sectionIndex, optionIndex)
                    )}
                  </View>
                ))}

                {filteredSections.every(
                  (section) => section.options.length === 0
                ) && (
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      variant='body'
                      style={{
                        color: textMutedColor,
                        fontSize: 15,
                        textAlign: 'center',
                      }}
                    >
                      {searchQuery
                        ? 'Nenhum resultado encontrado'
                        : 'Nenhuma opção disponível'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
