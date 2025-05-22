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
} 