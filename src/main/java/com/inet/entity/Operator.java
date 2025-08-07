package com.inet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "operator")
@Getter
@Setter
@NoArgsConstructor
public class Operator {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "operator_id")
    private Long operatorId;
    
    private String name;
    
    private String position;
    
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;
    
    public String getName() {
        return this.name;
    }
    
    public String getPosition() {
        return this.position;
    }
    
    public void setSchool(School school) {
        this.school = school;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public void setPosition(String position) {
        this.position = position;
    }
} 