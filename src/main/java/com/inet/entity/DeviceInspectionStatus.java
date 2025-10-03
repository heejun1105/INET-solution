package com.inet.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "device_inspection_status", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"device_id", "school_id", "inspector_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeviceInspectionStatus {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "device_id", nullable = false)
    private Long deviceId;
    
    @Column(name = "school_id", nullable = false)
    private Long schoolId;
    
    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "inspection_status", nullable = false)
    private InspectionStatus inspectionStatus = InspectionStatus.UNCHECKED;
    
    public enum InspectionStatus {
        UNCHECKED("unchecked"),
        CONFIRMED("confirmed"),
        MODIFIED("modified");
        
        private final String value;
        
        InspectionStatus(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
        
        public static InspectionStatus fromValue(String value) {
            for (InspectionStatus status : values()) {
                if (status.value.equals(value)) {
                    return status;
                }
            }
            return UNCHECKED;
        }
    }
}
