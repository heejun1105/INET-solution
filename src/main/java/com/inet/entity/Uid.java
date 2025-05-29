package com.inet.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "uid")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Uid {
    
    @Id //고유번호 엔티티
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "uid_id")
    private Long uidId;
    
    @Column(name = "cate", nullable = false)
    private String cate;
    
    @Column(name = "id_number")
    private Long idNumber;

    @Column(name = "mfg_year")
    private String mfgYear;

    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;
    
    /**
     * 표시용 고유번호를 반환합니다.
     * 형식: 카테고리 + 학교코드 + 제조연도 + ID번호
     */
    public String getDisplayId() {
        if (cate == null || idNumber == null) {
            return "";
        }
        
        StringBuilder sb = new StringBuilder();
        sb.append(cate);
        
        if (school != null && school.getIp() != null) {
            sb.append(String.format("%02d", school.getIp()));
        }
        
        if (mfgYear != null && !mfgYear.isEmpty()) {
            sb.append(mfgYear);
        }
        
        sb.append(String.format("%04d", idNumber));
        
        return sb.toString();
    }
} 