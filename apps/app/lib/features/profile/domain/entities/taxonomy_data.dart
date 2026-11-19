enum SkillProficiencyLevel {
  beginner,
  intermediate,
  advanced,
  expert;

  String get label {
    switch (this) {
      case SkillProficiencyLevel.beginner:
        return 'Beginner';
      case SkillProficiencyLevel.intermediate:
        return 'Intermediate';
      case SkillProficiencyLevel.advanced:
        return 'Advanced';
      case SkillProficiencyLevel.expert:
        return 'Expert';
    }
  }

  String get apiValue => name.toUpperCase();

  static SkillProficiencyLevel fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'BEGINNER':
        return SkillProficiencyLevel.beginner;
      case 'ADVANCED':
        return SkillProficiencyLevel.advanced;
      case 'EXPERT':
        return SkillProficiencyLevel.expert;
      case 'INTERMEDIATE':
      default:
        return SkillProficiencyLevel.intermediate;
    }
  }
}

class CategoryItem {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final List<String> subcategories;

  const CategoryItem({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.subcategories = const [],
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    return CategoryItem(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      subcategories: (json['subcategories'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}

class SkillItem {
  final String id;
  final String slug;
  final String name;

  const SkillItem({
    required this.id,
    required this.slug,
    required this.name,
  });

  factory SkillItem.fromJson(Map<String, dynamic> json) {
    return SkillItem(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }
}

class UserSkillSelection {
  final String skillId;
  final String name;
  final SkillProficiencyLevel proficiency;

  const UserSkillSelection({
    required this.skillId,
    required this.name,
    this.proficiency = SkillProficiencyLevel.intermediate,
  });

  UserSkillSelection copyWith({
    String? skillId,
    String? name,
    SkillProficiencyLevel? proficiency,
  }) {
    return UserSkillSelection(
      skillId: skillId ?? this.skillId,
      name: name ?? this.name,
      proficiency: proficiency ?? this.proficiency,
    );
  }

  Map<String, dynamic> toJson() => {
        'skillId': skillId,
        'name': name,
        'proficiency': proficiency.apiValue,
      };

  factory UserSkillSelection.fromJson(Map<String, dynamic> json) {
    return UserSkillSelection(
      skillId: json['skillId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      proficiency: SkillProficiencyLevel.fromString(json['proficiency'] as String?),
    );
  }
}
