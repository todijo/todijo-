import 'package:flutter/material.dart';

import 'todijo_localizations.dart';

class TodijoCountryPicker extends StatelessWidget {
  const TodijoCountryPicker({
    required this.value,
    required this.onChanged,
    this.label,
    super.key,
  });

  final String? value;
  final ValueChanged<String?> onChanged;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    final countries = [...TodijoLocalizations.shippingCountries]
      ..sort((a, b) => copy.countryName(a).compareTo(copy.countryName(b)));
    return DropdownButtonFormField<String>(
      initialValue: countries.contains(value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label ?? copy.text('country')),
      items: [
        for (final code in countries)
          DropdownMenuItem(
            value: code,
            child: Text(
              copy.countryName(code),
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
      onChanged: onChanged,
      validator: (selected) =>
          selected == null ? copy.text('selectCountry') : null,
    );
  }
}
