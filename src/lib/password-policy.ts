/**
 * @file password-policy.ts
 * @description 密碼政策與驗證模組
 *
 * 此模組定義 RMS 系統的密碼安全政策和驗證邏輯。
 *
 * ## 核心功能
 * - `validatePassword`：驗證密碼是否符合政策
 * - `getPasswordRequirements`：取得密碼要求列表（供 UI 顯示）
 *
 * ## 預設政策 (PASSWORD_POLICY)
 * - 最短長度：8 字元
 * - 需包含大寫字母：是
 * - 需包含小寫字母：是
 * - 需包含數字：是
 * - 需包含特殊字元：否（可設定啟用）
 *
 * ## 密碼強度評估
 * - `weak`：滿足少於 3 項要求
 * - `medium`：滿足 3-4 項要求
 * - `strong`：滿足 5 項要求，或 4 項且長度 >= 12
 *
 * @see /src/actions/users.ts - 使用者管理（呼叫 validatePassword）
 * @see /src/components/admin/UserForm.tsx - 密碼輸入 UI
 */

export const PASSWORD_POLICY = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: false, // Can be enabled if needed
};

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validate password against policy
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < PASSWORD_POLICY.minLength) {
        errors.push(`密碼長度至少 ${PASSWORD_POLICY.minLength} 字元`);
    }
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('需包含至少一個大寫字母');
    }
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('需包含至少一個小寫字母');
    }
    if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
        errors.push('需包含至少一個數字');
    }
    if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('需包含至少一個特殊字元');
    }

    // Calculate strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strengthPoints = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

    if (strengthPoints >= 5 || (strengthPoints >= 4 && password.length >= 12)) {
        strength = 'strong';
    } else if (strengthPoints >= 3) {
        strength = 'medium';
    }

    return {
        valid: errors.length === 0,
        errors,
        strength,
    };
}

/**
 * Get password requirements as a list (for UI display)
 */
export function getPasswordRequirements(): { key: string; label: string; check: (password: string) => boolean }[] {
    const requirements = [
        {
            key: 'length',
            label: `至少 ${PASSWORD_POLICY.minLength} 個字元`,
            check: (p: string) => p.length >= PASSWORD_POLICY.minLength,
        },
    ];

    if (PASSWORD_POLICY.requireUppercase) {
        requirements.push({
            key: 'uppercase',
            label: '至少一個大寫字母 (A-Z)',
            check: (p: string) => /[A-Z]/.test(p),
        });
    }
    if (PASSWORD_POLICY.requireLowercase) {
        requirements.push({
            key: 'lowercase',
            label: '至少一個小寫字母 (a-z)',
            check: (p: string) => /[a-z]/.test(p),
        });
    }
    if (PASSWORD_POLICY.requireNumber) {
        requirements.push({
            key: 'number',
            label: '至少一個數字 (0-9)',
            check: (p: string) => /\d/.test(p),
        });
    }
    if (PASSWORD_POLICY.requireSpecial) {
        requirements.push({
            key: 'special',
            label: '至少一個特殊字元 (!@#$%...)',
            check: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
        });
    }

    return requirements;
}
