package com.inet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import jakarta.persistence.OneToMany;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

@Entity
@Table(name = "school")
@Getter
@Setter
@NoArgsConstructor
public class School {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "school_id")
    private Long schoolId;
    
    @Column(name = "school_name")
    private String schoolName;
    
    private Integer ip;

    @OneToMany(mappedBy = "school")
    @JsonIgnore  // 순환 참조 방지
    private List<Classroom> classrooms;

    @OneToMany(mappedBy = "school")
    @JsonIgnore  // 순환 참조 방지
    private List<Operator> operators;

    // Explicit getter methods
    public Long getSchoolId() {
        return this.schoolId;
    }

    public String getSchoolName() {
        return this.schoolName;
    }

    public Integer getIp() {
        return this.ip;
    }

    public List<Classroom> getClassrooms() {
        return this.classrooms;
    }

    public List<Operator> getOperators() {
        return this.operators;
    }
    
    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }
    
    public void setSchoolName(String schoolName) {
        this.schoolName = schoolName;
    }
    
    public void setIp(Integer ip) {
        this.ip = ip;
    }
} 