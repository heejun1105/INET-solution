package com.inet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import lombok.Data;

@Entity
@Table(name = "manage")
@Data
public class Manage {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "manage_id")
    private Long manageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id")
    private School school;

    @Column(name = "manage_cate")
    private String manageCate;
    
    @Column(name = "year")
    private Integer year;
    
    @Column(name = "manage_num")
    private Long manageNum;

    // Explicit getter methods
    public String getManageCate() {
        return this.manageCate;
    }

    public Integer getYear() {
        return this.year;
    }

    public Long getManageNum() {
        return this.manageNum;
    }

    public School getSchool() {
        return this.school;
    }
    
    /**
     * 표시용 관리번호를 반환합니다.
     * 형식: 관리카테고리-연도-일련번호 또는 관리카테고리-일련번호
     */
    public String getDisplayId() {
        if (manageCate == null || manageNum == null) {
            return "";
        }
        
        StringBuilder sb = new StringBuilder();
        sb.append(manageCate);
        
        if (year != null) {
            sb.append("-").append(year);
        }
        
        sb.append("-").append(String.format("%03d", manageNum));
        
        return sb.toString();
    }
} 