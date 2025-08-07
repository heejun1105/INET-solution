package com.inet.entity;

public enum UserRole {
    ADMIN("관리자"),
    EMPLOYEE("직원"),
    EXTERNAL("외부");
    
    private final String displayName;
    
    UserRole(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
} 