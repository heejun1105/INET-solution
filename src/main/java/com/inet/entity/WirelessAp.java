package com.inet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import lombok.EqualsAndHashCode;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "wireless_ap")
@Getter
@Setter
@ToString(exclude = {"location", "school"})
@EqualsAndHashCode(exclude = {"location", "school"})
@AllArgsConstructor
@NoArgsConstructor
public class WirelessAp {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long APId;

    @ManyToOne
    @JoinColumn(name = "location")
    private Classroom location;

    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;

    @Column(name = "new_label_number")
    private String newLabelNumber;

    @Column(name = "device_number")
    private String deviceNumber;

    @Column(name = "ap_year")
    private LocalDate APYear;

    @Column(name = "manufacturer")
    private String manufacturer;

    @Column(name = "model")
    private String model;

    @Column(name = "mac_address")
    private String macAddress;

    @Column(name = "prev_location")
    private String prevLocation;

    @Column(name = "prev_label_number")
    private String prevLabelNumber;

    @Column(name = "classroom_type")
    private String classroomType;
    
    @Column(name = "speed")
    private String speed;

    // Manual setter methods for compilation
    public void setAPId(Long APId) {
        this.APId = APId;
    }

    public void setLocation(Classroom location) {
        this.location = location;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public void setNewLabelNumber(String newLabelNumber) {
        this.newLabelNumber = newLabelNumber;
    }

    public void setDeviceNumber(String deviceNumber) {
        this.deviceNumber = deviceNumber;
    }

    public void setAPYear(LocalDate APYear) {
        this.APYear = APYear;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public void setMacAddress(String macAddress) {
        this.macAddress = macAddress;
    }

    public void setPrevLocation(String prevLocation) {
        this.prevLocation = prevLocation;
    }

    public void setPrevLabelNumber(String prevLabelNumber) {
        this.prevLabelNumber = prevLabelNumber;
    }

    public void setClassroomType(String classroomType) {
        this.classroomType = classroomType;
    }
    
    public void setSpeed(String speed) {
        this.speed = speed;
    }

    // Manual getter methods for compilation
    public Long getAPId() {
        return this.APId;
    }

    public Classroom getLocation() {
        return this.location;
    }

    public School getSchool() {
        return this.school;
    }

    public String getNewLabelNumber() {
        return this.newLabelNumber;
    }

    public String getDeviceNumber() {
        return this.deviceNumber;
    }

    public LocalDate getAPYear() {
        return this.APYear;
    }

    public String getManufacturer() {
        return this.manufacturer;
    }

    public String getModel() {
        return this.model;
    }

    public String getMacAddress() {
        return this.macAddress;
    }

    public String getPrevLocation() {
        return this.prevLocation;
    }

    public String getPrevLabelNumber() {
        return this.prevLabelNumber;
    }

    public String getClassroomType() {
        return this.classroomType;
    }
    
    public String getSpeed() {
        return this.speed;
    }
} 