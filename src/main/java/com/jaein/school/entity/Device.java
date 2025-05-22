package com.jaein.school.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "devices")
@Getter @Setter
public class Device {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long deviceId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id")
    private School school;
    
    @Column(nullable = false)
    private String type;
    
    private String manufacturer;
    
    private String modelName;
    
    private String ipAddress;
    
    private String location;
    
    private String purpose;
    
    private String setType;
    
    private boolean unused;
    
    @Column(name = "purchase_date")
    private String purchaseDate;
    
    private String note;
} 