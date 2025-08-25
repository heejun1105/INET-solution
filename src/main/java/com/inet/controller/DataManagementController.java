package com.inet.controller;

import com.inet.service.DataManagementService;
import com.inet.service.SchoolService;
import com.inet.entity.School;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.ArrayList;
import java.util.List;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Controller
@RequestMapping("/data")
public class DataManagementController {
    
    private final SchoolService schoolService;
    private final DataManagementService dataManagementService;
    private final PermissionService permissionService;
    private final SchoolPermissionService schoolPermissionService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;

    @Autowired
    public DataManagementController(SchoolService schoolService, DataManagementService dataManagementService,
                                  PermissionService permissionService, SchoolPermissionService schoolPermissionService,
                                  UserService userService, PermissionHelper permissionHelper) {
        this.schoolService = schoolService;
        this.dataManagementService = dataManagementService;
        this.permissionService = permissionService;
        this.schoolPermissionService = schoolPermissionService;
        this.userService = userService;
        this.permissionHelper = permissionHelper;
    }

    // 권한 체크 메서드
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }

    @GetMapping("/delete")
    public String showDeleteForm(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.DATA_DELETE, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "data/delete";
    }

    @PostMapping("/delete")
    public String deleteSchoolData(@RequestParam("schoolIds") List<Long> schoolIds, 
                                 @RequestParam(value = "deleteType", required = false) String deleteType,
                                 @RequestParam(value = "deleteDevices", required = false, defaultValue = "false") boolean deleteDevices,
                                 @RequestParam(value = "deleteWirelessAps", required = false, defaultValue = "false") boolean deleteWirelessAps,
                                 @RequestParam(value = "deleteClassrooms", required = false, defaultValue = "false") boolean deleteClassrooms,
                                 @RequestParam(value = "deleteOperators", required = false, defaultValue = "false") boolean deleteOperators,
                                 @RequestParam(value = "deleteManages", required = false, defaultValue = "false") boolean deleteManages,
                                 @RequestParam(value = "deleteUids", required = false, defaultValue = "false") boolean deleteUids,
                                 @RequestParam(value = "deleteDeviceHistory", required = false, defaultValue = "false") boolean deleteDeviceHistory,
                                 @RequestParam(value = "periodType", required = false, defaultValue = "all") String periodType,
                                 @RequestParam(value = "deleteBeforeDate", required = false) String deleteBeforeDate,
                                 RedirectAttributes redirectAttributes) {
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkPermission(Feature.DATA_DELETE, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        // 선택된 학교들에 대한 권한 체크
        for (Long schoolId : schoolIds) {
            User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.DATA_DELETE, schoolId, null);
            if (checkedUser == null) {
                redirectAttributes.addFlashAttribute("error", "ID가 " + schoolId + "인 학교에 대한 권한이 없습니다.");
                return "redirect:/data/delete";
            }
        }
        
        if (schoolIds == null || schoolIds.isEmpty()) {
            redirectAttributes.addFlashAttribute("error", "삭제할 학교를 하나 이상 선택해주세요.");
            return "redirect:/data/delete";
        }

        try {
            List<String> schoolNames = new ArrayList<>();
            for (Long schoolId : schoolIds) {
                School school = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("ID가 " + schoolId + "인 학교를 찾을 수 없습니다."));
                schoolNames.add(school.getSchoolName());

                if ("all".equals(deleteType)) {
                    dataManagementService.deleteSchoolData(schoolId);
                } else if ("selective".equals(deleteType)) {
                    dataManagementService.deleteSelectedDataTypes(schoolId, deleteDevices, deleteWirelessAps, 
                                                                 deleteClassrooms, deleteOperators, deleteManages, deleteUids, 
                                                                 deleteDeviceHistory, periodType, deleteBeforeDate);
                }
            }
            
            String message = "";
            String schoolsStr = String.join(", ", schoolNames);

            if ("all".equals(deleteType)) {
                message = schoolsStr + "의 모든 데이터가 성공적으로 삭제되었습니다.";
            } else if ("selective".equals(deleteType)) {
                if (!deleteDevices && !deleteWirelessAps && !deleteClassrooms && 
                    !deleteOperators && !deleteManages && !deleteUids && !deleteDeviceHistory) {
                    redirectAttributes.addFlashAttribute("error", "삭제할 데이터 유형을 하나 이상 선택해주세요.");
                    return "redirect:/data/delete";
                }
                
                StringBuilder messageBuilder = new StringBuilder(schoolsStr + "의 ");
                List<String> dataTypes = new ArrayList<>();
                if (deleteDevices) dataTypes.add("장비");
                if (deleteWirelessAps) dataTypes.add("무선 AP");
                if (deleteClassrooms) dataTypes.add("교실");
                if (deleteOperators) dataTypes.add("운영자");
                if (deleteManages) dataTypes.add("관리번호");
                if (deleteUids) dataTypes.add("고유번호");
                if (deleteDeviceHistory) dataTypes.add("장비 수정내역");
                
                messageBuilder.append(String.join(", ", dataTypes));
                messageBuilder.append(" 데이터가 성공적으로 삭제되었습니다.");
                message = messageBuilder.toString();
            } else {
                redirectAttributes.addFlashAttribute("error", "삭제 유형을 선택해주세요.");
                return "redirect:/data/delete";
            }
            
            redirectAttributes.addFlashAttribute("message", message);
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "데이터 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "redirect:/data/delete";
    }
} 