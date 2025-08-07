package com.inet.entity;

public enum UserStatus {
    PENDING("승인대기"),
    APPROVED("승인됨"),
    REJECTED("거부됨"),
    SUSPENDED("정지됨");
    
    private final String displayName;
    
    UserStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
} 