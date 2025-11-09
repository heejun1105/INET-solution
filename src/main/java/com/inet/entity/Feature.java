package com.inet.entity;

public enum Feature {
    DEVICE_LIST("장비목록"),
    DEVICE_MANAGEMENT("장비관리"),
    DEVICE_INSPECTION("장비검사"),
    SCHOOL_MANAGEMENT("학교관리"),
    CLASSROOM_MANAGEMENT("교실관리"),
    FLOORPLAN_MANAGEMENT("평면도관리"),
    DATA_DELETE("데이터삭제"),
    WIRELESS_AP_LIST("무선AP목록"),
    WIRELESS_AP_MANAGEMENT("무선AP관리"),
    SUBMISSION_FILES("파일다운"),
    QR_CODE_GENERATION("QR코드생성");
    
    private final String displayName;
    
    Feature(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
} 