package com.inet.entity;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "device")
@Getter
@Setter
@ToString(exclude = {"classroom"})
@EqualsAndHashCode(exclude = {"classroom"})
public class Device {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "device_id")
    private Long deviceId;
    
    private String type;
    
    private String manufacturer;
    
    @Column(name = "model_name")
    private String modelName;
    
    @Column(name = "purchase_date")
    private LocalDate purchaseDate;
    
    @Column(name = "ip_address")
    private String ipAddress;
    
    @ManyToOne
    @JoinColumn(name = "classroom_id")
    @JsonBackReference
    private Classroom classroom;
    
    private String purpose; 
    
    @Column(name = "set_type")
    private String setType;
    
    private Boolean unused = false;
    
    @Column(columnDefinition = "TEXT")
    private String note;
    
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;
    
    @ManyToOne
    @JoinColumn(name = "operator_id")
    private Operator operator;
    
    @ManyToOne
    @JoinColumn(name = "manage_id")
    private Manage manage;
    
    @ManyToOne
    @JoinColumn(name = "uid_id")
    private Uid uid;

    // Explicit getter methods
    public String getIpAddress() {
        return this.ipAddress;
    }

    public String getType() {
        return this.type;
    }

    public Classroom getClassroom() {
        return this.classroom;
    }

    // Explicit setter methods
    public void setManage(Manage manage) {
        this.manage = manage;
    }

    public void setClassroom(Classroom classroom) {
        this.classroom = classroom;
    }

    public void setOperator(Operator operator) {
        this.operator = operator;
    }

    public void setUid(Uid uid) {
        this.uid = uid;
    }

    public void setSchool(School school) {
        this.school = school;
    }
} 