package com.inet.config;

import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.entity.School;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.SchoolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Component
public class PermissionHelper {
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private SchoolPermissionService schoolPermissionService;
    
    @Autowired
    private SchoolService schoolService;
    
    public void addPermissionAttributes(User user, Model model) {
        if (user != null) {
            // 각 기능에 대한 권한 확인
            model.addAttribute("hasDeviceListPermission", permissionService.hasPermission(user, Feature.DEVICE_LIST));
            model.addAttribute("hasDeviceManagementPermission", permissionService.hasPermission(user, Feature.DEVICE_MANAGEMENT));
            model.addAttribute("hasSchoolManagementPermission", permissionService.hasPermission(user, Feature.SCHOOL_MANAGEMENT));
            model.addAttribute("hasClassroomManagementPermission", permissionService.hasPermission(user, Feature.CLASSROOM_MANAGEMENT));
            model.addAttribute("hasFloorplanManagementPermission", permissionService.hasPermission(user, Feature.FLOORPLAN_MANAGEMENT));
            model.addAttribute("hasDataDeletePermission", permissionService.hasPermission(user, Feature.DATA_DELETE));
            model.addAttribute("hasWirelessApListPermission", permissionService.hasPermission(user, Feature.WIRELESS_AP_LIST));
            model.addAttribute("hasWirelessApManagementPermission", permissionService.hasPermission(user, Feature.WIRELESS_AP_MANAGEMENT));
            model.addAttribute("hasSubmissionFilesPermission", permissionService.hasPermission(user, Feature.SUBMISSION_FILES));
        } else {
            // 비로그인 사용자를 위한 기본값 설정
            model.addAttribute("hasDeviceListPermission", false);
            model.addAttribute("hasDeviceManagementPermission", false);
            model.addAttribute("hasSchoolManagementPermission", false);
            model.addAttribute("hasClassroomManagementPermission", false);
            model.addAttribute("hasFloorplanManagementPermission", false);
            model.addAttribute("hasDataDeletePermission", false);
            model.addAttribute("hasWirelessApListPermission", false);
            model.addAttribute("hasWirelessApManagementPermission", false);
            model.addAttribute("hasSubmissionFilesPermission", false);
        }
    }
    
    /**
     * 권한이 없는 기능에 접근할 때 표시할 메시지를 반환합니다.
     */
    public String getPermissionDeniedMessage(Feature feature) {
        switch (feature) {
            case DEVICE_LIST:
                return "장비 목록 조회 권한이 없습니다. 관리자에게 문의하세요.";
            case DEVICE_MANAGEMENT:
                return "장비 관리 권한이 없습니다. 관리자에게 문의하세요.";
            case SCHOOL_MANAGEMENT:
                return "학교 관리 권한이 없습니다. 관리자에게 문의하세요.";
            case CLASSROOM_MANAGEMENT:
                return "교실 관리 권한이 없습니다. 관리자에게 문의하세요.";
            case FLOORPLAN_MANAGEMENT:
                return "평면도 관리 권한이 없습니다. 관리자에게 문의하세요.";
            case DATA_DELETE:
                return "데이터 삭제 권한이 없습니다. 관리자에게 문의하세요.";
            case WIRELESS_AP_LIST:
                return "무선AP 목록 조회 권한이 없습니다. 관리자에게 문의하세요.";
            case WIRELESS_AP_MANAGEMENT:
                return "무선AP 관리 권한이 없습니다. 관리자에게 문의하세요.";
            case SUBMISSION_FILES:
                return "제출 파일 관리 권한이 없습니다. 관리자에게 문의하세요.";
            default:
                return "해당 기능에 대한 권한이 없습니다. 관리자에게 문의하세요.";
        }
    }
    
    /**
     * 기능 권한과 학교 권한을 모두 체크합니다.
     * @param user 사용자
     * @param feature 기능 권한
     * @param schoolId 학교 ID (null이면 학교 권한 체크 생략)
     * @param redirectAttributes 리다이렉트 속성
     * @return 권한이 있으면 User 객체, 없으면 null
     */
    public User checkSchoolPermission(User user, Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        // 1. 기능 권한 체크
        if (!permissionService.hasPermission(user, feature)) {
            redirectAttributes.addFlashAttribute("error", getPermissionDeniedMessage(feature));
            return null;
        }
        
        // 2. 학교 권한 체크 (schoolId가 있는 경우만)
        if (schoolId != null) {
            School school = schoolService.getSchoolById(schoolId).orElse(null);
            if (school == null) {
                redirectAttributes.addFlashAttribute("error", "존재하지 않는 학교입니다.");
                return null;
            }
            
            if (!schoolPermissionService.hasSchoolPermission(user, school)) {
                redirectAttributes.addFlashAttribute("error", "해당 학교에 대한 권한이 없습니다. 관리자에게 문의하세요.");
                return null;
            }
        }
        
        return user;
    }
    
    /**
     * 기능 권한만 체크합니다.
     * @param user 사용자
     * @param feature 기능 권한
     * @param redirectAttributes 리다이렉트 속성
     * @return 권한이 있으면 User 객체, 없으면 null
     */
    public User checkFeaturePermission(User user, Feature feature, RedirectAttributes redirectAttributes) {
        if (!permissionService.hasPermission(user, feature)) {
            redirectAttributes.addFlashAttribute("error", getPermissionDeniedMessage(feature));
            return null;
        }
        return user;
    }
}
