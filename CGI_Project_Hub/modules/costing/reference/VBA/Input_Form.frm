Attribute VB_Name = "Input_Form"
Attribute VB_Base = "0{49CD1464-498B-4DEC-84A1-48E8B2664130}{C1E37F42-DBA1-4373-BC17-A0B7AB292C97}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False
Dim TimelineEdit As Boolean
Dim PaymentEdit As Boolean
Dim logoPic As Shape

Private Sub loadCurrentData()
    'Set Quote & Supplier Details
    txtQuote_No.Text = Range("Quote_Number").Text
    txtProj_No.Text = Range("Project_Number").Text
    cmDocType.Text = Range("Document").Text
    txtClient_Comp.Text = Range("Client_Company").Text
    txtClient_Name.Text = Range("Client_Name").Text
    txtClient_Email.Text = Range("Client_Email").Text
    txtProj_Desc.Text = Range("Project_Descr").Text
    cmCurrency.Value = Range("Project_Currency").Text
    txtClient_FinalDest.Text = Range("Final_Destination").Text
    txtClient_EnquiryRef.Text = Range("Enquiry_Ref").Text
    cmSupp_Company.Text = Range("Supp_Company").Text
    cmSupp_Person.Text = Range("Supp_Representative").Text
    txtProj_Scope.Text = Range("Scope_Descr").Text
    
    'Set Input Details
    txtInput_DeliveryWeeks.Text = Range("Delivery_Weeks").Text
    txtInput_PaymentDays.Text = Range("Payment_Days").Text
    cmInputs_PaymentType.Value = Range("Payment_Type").Text
    
    
    If Range("Inclusions").Text = "Yes" Then
        cbInputs_Inclusions.Value = True
    Else
        cbInputs_Inclusions.Value = False
    End If
    
    If Range("Assumptions").Text = "Yes" Then
        cbInputs_Assumptions.Value = True
    Else
        cbInputs_Assumptions.Value = False
    End If
    
    If Range("Exclusions").Text = "Yes" Then
        cbInputs_Exclusions.Value = True
    Else
        cbInputs_Exclusions.Value = False
    End If

    txtInput_QuoteValid.Text = Range("Quote_Validity").Text
    txtInput_ServValid.Text = Range("Serv_Validity").Text
    txtInput_EquipValid.Text = Range("Equip_Validity").Text
    
    If Range("Man_Hours").Text = "Yes" Then
        cbInputs_ManHours.Value = True
    Else
        cbInputs_ManHours.Value = False
    End If
    
    txtInputs_EngRate.Text = Range("Eng_MH").Value
    txtInputs_AccRate.Text = Range("Accom_MH").Value
    txtInputs_LOARate.Text = Range("LOA_MH").Value
    txtInputs_TravelRate.Text = Range("Travel_MH").Value
    cmCurrency.Value = Range("Quoted_Currency").Text
    
    If Range("Tax_Cert").Text = "Yes" Then
        cbInputs_TaxCert.Value = True
    Else
        cbInputs_TaxCert.Value = False
    End If
    
    txtInputs_IncotermsDest.Text = Range("Incoterms_Add").Text
    cmInputs_Incoterms.Value = Range("Incoterms_Type").Text
    
    'Set Timeline Details
    'Set Timeline Details
    cmTimelineUnit.Value = Range("DWM").Text
    
    txtTimeline_Time1.Text = Range("Est_Timeline").Cells(2, 1).Text
    txtTimeline_Time2.Text = Range("Est_Timeline").Cells(3, 1).Text
    txtTimeline_Time3.Text = Range("Est_Timeline").Cells(4, 1).Text
    txtTimeline_Time4.Text = Range("Est_Timeline").Cells(5, 1).Text
    txtTimeline_Time5.Text = Range("Est_Timeline").Cells(6, 1).Text
    txtTimeline_Time6.Text = Range("Est_Timeline").Cells(7, 1).Text
    txtTimeline_Time7.Text = Range("Est_Timeline").Cells(8, 1).Text
    txtTimeline_Time8.Text = Range("Est_Timeline").Cells(9, 1).Text
    txtTimeline_Time9.Text = Range("Est_Timeline").Cells(10, 1).Text
    txtTimeline_Time10.Text = Range("Est_Timeline").Cells(11, 1).Text
    txtTimeline_Time11.Text = Range("Est_Timeline").Cells(12, 1).Text
    txtTimeline_Time12.Text = Range("Est_Timeline").Cells(13, 1).Text
    txtTimeline_Time13.Text = Range("Est_Timeline").Cells(14, 1).Text
    
    txtTimeline_Desc1.Text = Range("Est_Timeline_Desc").Cells(2, 1).Text
    txtTimeline_Desc2.Text = Range("Est_Timeline_Desc").Cells(3, 1).Text
    txtTimeline_Desc3.Text = Range("Est_Timeline_Desc").Cells(4, 1).Text
    txtTimeline_Desc4.Text = Range("Est_Timeline_Desc").Cells(5, 1).Text
    txtTimeline_Desc5.Text = Range("Est_Timeline_Desc").Cells(6, 1).Text
    txtTimeline_Desc6.Text = Range("Est_Timeline_Desc").Cells(7, 1).Text
    txtTimeline_Desc7.Text = Range("Est_Timeline_Desc").Cells(8, 1).Text
    txtTimeline_Desc8.Text = Range("Est_Timeline_Desc").Cells(9, 1).Text
    txtTimeline_Desc9.Text = Range("Est_Timeline_Desc").Cells(10, 1).Text
    txtTimeline_Desc10.Text = Range("Est_Timeline_Desc").Cells(11, 1).Text
    txtTimeline_Desc11.Text = Range("Est_Timeline_Desc").Cells(12, 1).Text
    txtTimeline_Desc12.Text = Range("Est_Timeline_Desc").Cells(13, 1).Text
    txtTimeline_Desc13.Text = Range("Est_Timeline_Desc").Cells(14, 1).Text
    
    'Set Payment Details
    txtPay_Perc1.Text = Range("Payment_Perc").Cells(2, 1).Value * 100
    txtPay_Perc2.Text = Range("Payment_Perc").Cells(3, 1).Value * 100
    txtPay_Perc3.Text = Range("Payment_Perc").Cells(4, 1).Value * 100
    txtPay_Perc4.Text = Range("Payment_Perc").Cells(5, 1).Value * 100
    txtPay_Perc5.Text = Range("Payment_Perc").Cells(6, 1).Value * 100
    txtPay_Perc6.Text = Range("Payment_Perc").Cells(7, 1).Value * 100
    txtPay_Perc7.Text = Range("Payment_Perc").Cells(8, 1).Value * 100
    txtPay_Perc8.Text = Range("Payment_Perc").Cells(9, 1).Value * 100
    txtPay_Perc9.Text = Range("Payment_Perc").Cells(10, 1).Value * 100
    txtPay_Perc10.Text = Range("Payment_Perc").Cells(11, 1).Value * 100
    txtPay_Perc11.Text = Range("Payment_Perc").Cells(12, 1).Value * 100
    txtPay_Perc12.Text = Range("Payment_Perc").Cells(13, 1).Value * 100
    
    txtPay_Desc1.Text = Range("Payment_Desc").Cells(2, 1).Text
    txtPay_Desc2.Text = Range("Payment_Desc").Cells(3, 1).Text
    txtPay_Desc3.Text = Range("Payment_Desc").Cells(4, 1).Text
    txtPay_Desc4.Text = Range("Payment_Desc").Cells(5, 1).Text
    txtPay_Desc5.Text = Range("Payment_Desc").Cells(6, 1).Text
    txtPay_Desc6.Text = Range("Payment_Desc").Cells(7, 1).Text
    txtPay_Desc7.Text = Range("Payment_Desc").Cells(8, 1).Text
    txtPay_Desc8.Text = Range("Payment_Desc").Cells(9, 1).Text
    txtPay_Desc9.Text = Range("Payment_Desc").Cells(10, 1).Text
    txtPay_Desc10.Text = Range("Payment_Desc").Cells(11, 1).Text
    txtPay_Desc11.Text = Range("Payment_Desc").Cells(12, 1).Text
    txtPay_Desc12.Text = Range("Payment_Desc").Cells(13, 1).Text
    
End Sub



Private Sub btnAccept_Click()
    'Set Quote & Supplier Details
    Range("Quote_Number") = txtQuote_No.Text
    Range("Project_Number") = txtProj_No.Text
    Range("Document") = cmDocType.Value
    Range("Client_Company") = txtClient_Comp.Text
    Range("Client_Name") = txtClient_Name.Text
    Range("Client_Email") = txtClient_Email.Text
    Range("Project_Descr") = txtProj_Desc.Text
    Range("Project_Currency") = cmCurrency.Value
    Range("Final_Destination") = txtClient_FinalDest.Text
    Range("Enquiry_Ref") = txtClient_EnquiryRef.Text
    Range("Supp_Company") = cmSupp_Company.Value
    Range("Supp_Representative") = cmSupp_Person.Value
    Range("Scope_Descr") = txtProj_Scope.Text
    
    'Set Input Details
    Range("Delivery_Weeks") = txtInput_DeliveryWeeks.Text
    Range("Payment_Days") = txtInput_PaymentDays.Text
    Range("Payment_Type") = cmInputs_PaymentType.Value
    
    If cbInputs_Inclusions.Value Then
        Range("Inclusions") = "Yes"
    Else
        Range("Inclusions") = "No"
    End If
    
    If cbInputs_Assumptions.Value Then
        Range("Assumptions") = "Yes"
    Else
        Range("Assumptions") = "No"
    End If
    
    If cbInputs_Exclusions.Value Then
        Range("Exclusions") = "Yes"
    Else
        Range("Exclusions") = "No"
    End If

    Range("Quote_Validity") = txtInput_QuoteValid.Text
    Range("Serv_Validity") = txtInput_ServValid.Text
    Range("Equip_Validity") = txtInput_EquipValid.Text
    
    If cbInputs_ManHours.Value Then
        Range("Man_Hours") = "Yes"
    Else
        Range("Man_Hours") = "No"
    End If
    
    Range("Eng_MH") = txtInputs_EngRate.Value
    Range("Accom_MH") = txtInputs_AccRate.Value
    Range("LOA_MH") = txtInputs_LOARate.Value
    Range("Travel_MH") = txtInputs_TravelRate.Value
    
    Range("Quoted_Currency") = cmCurrency.Value
    
    If cbInputs_TaxCert.Value Then
        Range("Tax_Cert") = "Yes"
    Else
        Range("Tax_Cert") = "No"
    End If
    
    Range("Incoterms_Add") = txtInputs_IncotermsDest.Text
    Range("Incoterms_Type") = cmInputs_Incoterms.Value
    
    'Set Timeline Details
    Range("DWM") = cmTimelineUnit.Value
    
    Range("Est_Timeline").Cells(2, 1) = txtTimeline_Time1.Text
    Range("Est_Timeline").Cells(3, 1) = txtTimeline_Time2.Text
    Range("Est_Timeline").Cells(4, 1) = txtTimeline_Time3.Text
    Range("Est_Timeline").Cells(5, 1) = txtTimeline_Time4.Text
    Range("Est_Timeline").Cells(6, 1) = txtTimeline_Time5.Text
    Range("Est_Timeline").Cells(7, 1) = txtTimeline_Time6.Text
    Range("Est_Timeline").Cells(8, 1) = txtTimeline_Time7.Text
    Range("Est_Timeline").Cells(9, 1) = txtTimeline_Time8.Text
    Range("Est_Timeline").Cells(10, 1) = txtTimeline_Time9.Text
    Range("Est_Timeline").Cells(11, 1) = txtTimeline_Time10.Text
    Range("Est_Timeline").Cells(12, 1) = txtTimeline_Time11.Text
    Range("Est_Timeline").Cells(13, 1) = txtTimeline_Time12.Text
    Range("Est_Timeline").Cells(14, 1) = txtTimeline_Time13.Text
    
    Range("Est_Timeline_Desc").Cells(2, 1) = txtTimeline_Desc1.Text
    Range("Est_Timeline_Desc").Cells(3, 1) = txtTimeline_Desc2.Text
    Range("Est_Timeline_Desc").Cells(4, 1) = txtTimeline_Desc3.Text
    Range("Est_Timeline_Desc").Cells(5, 1) = txtTimeline_Desc4.Text
    Range("Est_Timeline_Desc").Cells(6, 1) = txtTimeline_Desc5.Text
    Range("Est_Timeline_Desc").Cells(7, 1) = txtTimeline_Desc6.Text
    Range("Est_Timeline_Desc").Cells(8, 1) = txtTimeline_Desc7.Text
    Range("Est_Timeline_Desc").Cells(9, 1) = txtTimeline_Desc8.Text
    Range("Est_Timeline_Desc").Cells(10, 1) = txtTimeline_Desc9.Text
    Range("Est_Timeline_Desc").Cells(11, 1) = txtTimeline_Desc10.Text
    Range("Est_Timeline_Desc").Cells(12, 1) = txtTimeline_Desc11.Text
    Range("Est_Timeline_Desc").Cells(13, 1) = txtTimeline_Desc12.Text
    Range("Est_Timeline_Desc").Cells(14, 1) = txtTimeline_Desc13.Text
    
    'Set Payment Details
    Range("Payment_Perc").Cells(2, 1) = txtPay_Perc1.Value / 100
    Range("Payment_Perc").Cells(3, 1) = txtPay_Perc2.Value / 100
    Range("Payment_Perc").Cells(4, 1) = txtPay_Perc3.Value / 100
    Range("Payment_Perc").Cells(5, 1) = txtPay_Perc4.Value / 100
    Range("Payment_Perc").Cells(6, 1) = txtPay_Perc5.Value / 100
    Range("Payment_Perc").Cells(7, 1) = txtPay_Perc6.Value / 100
    Range("Payment_Perc").Cells(8, 1) = txtPay_Perc7.Value / 100
    Range("Payment_Perc").Cells(9, 1) = txtPay_Perc8.Value / 100
    Range("Payment_Perc").Cells(10, 1) = txtPay_Perc9.Value / 100
    Range("Payment_Perc").Cells(11, 1) = txtPay_Perc10.Value / 100
    Range("Payment_Perc").Cells(12, 1) = txtPay_Perc11.Value / 100
    Range("Payment_Perc").Cells(13, 1) = txtPay_Perc12.Value / 100
    
    Range("Payment_Desc").Cells(2, 1) = txtPay_Desc1.Text
    Range("Payment_Desc").Cells(3, 1) = txtPay_Desc2.Text
    Range("Payment_Desc").Cells(4, 1) = txtPay_Desc3.Text
    Range("Payment_Desc").Cells(5, 1) = txtPay_Desc4.Text
    Range("Payment_Desc").Cells(6, 1) = txtPay_Desc5.Text
    Range("Payment_Desc").Cells(7, 1) = txtPay_Desc6.Text
    Range("Payment_Desc").Cells(8, 1) = txtPay_Desc7.Text
    Range("Payment_Desc").Cells(9, 1) = txtPay_Desc8.Text
    Range("Payment_Desc").Cells(10, 1) = txtPay_Desc9.Text
    Range("Payment_Desc").Cells(11, 1) = txtPay_Desc10.Text
    Range("Payment_Desc").Cells(12, 1) = txtPay_Desc11.Text
    Range("Payment_Desc").Cells(13, 1) = txtPay_Desc12.Text
    
    
    Input_Form.Hide
End Sub

Private Sub btnPayDesc_Edit_Click()
    PaymentEdit = Not PaymentEdit
    
    If PaymentEdit Then
        txtPay_Desc1.Enabled = True
        txtPay_Desc2.Enabled = True
        txtPay_Desc3.Enabled = True
        txtPay_Desc4.Enabled = True
        txtPay_Desc5.Enabled = True
        txtPay_Desc6.Enabled = True
        txtPay_Desc7.Enabled = True
        txtPay_Desc8.Enabled = True
        txtPay_Desc9.Enabled = True
        txtPay_Desc10.Enabled = True
        txtPay_Desc11.Enabled = True
        txtPay_Desc12.Enabled = True
    Else
        txtPay_Desc1.Enabled = False
        txtPay_Desc2.Enabled = False
        txtPay_Desc3.Enabled = False
        txtPay_Desc4.Enabled = False
        txtPay_Desc5.Enabled = False
        txtPay_Desc6.Enabled = False
        txtPay_Desc7.Enabled = False
        txtPay_Desc8.Enabled = False
        txtPay_Desc9.Enabled = False
        txtPay_Desc10.Enabled = False
        txtPay_Desc11.Enabled = False
        txtPay_Desc12.Enabled = False
    End If
    
    
End Sub

Private Sub btnScope_Click()
    Scope_Form.Show
End Sub

Private Sub btnTimelineDesc_Edit_Click()
TimelineEdit = Not TimelineEdit
    
    If TimelineEdit Then
        txtTimeline_Desc1.Enabled = True
        txtTimeline_Desc2.Enabled = True
        txtTimeline_Desc3.Enabled = True
        txtTimeline_Desc4.Enabled = True
        txtTimeline_Desc5.Enabled = True
        txtTimeline_Desc6.Enabled = True
        txtTimeline_Desc7.Enabled = True
        txtTimeline_Desc8.Enabled = True
        txtTimeline_Desc9.Enabled = True
        txtTimeline_Desc10.Enabled = True
        txtTimeline_Desc11.Enabled = True
        txtTimeline_Desc12.Enabled = True
        txtTimeline_Desc13.Enabled = True
    Else
        txtTimeline_Desc1.Enabled = False
        txtTimeline_Desc2.Enabled = False
        txtTimeline_Desc3.Enabled = False
        txtTimeline_Desc4.Enabled = False
        txtTimeline_Desc5.Enabled = False
        txtTimeline_Desc6.Enabled = False
        txtTimeline_Desc7.Enabled = False
        txtTimeline_Desc8.Enabled = False
        txtTimeline_Desc9.Enabled = False
        txtTimeline_Desc10.Enabled = False
        txtTimeline_Desc11.Enabled = False
        txtTimeline_Desc12.Enabled = False
        txtTimeline_Desc13.Enabled = False
    End If
End Sub


Private Sub cbInputs_ManHours_Change()
If cbInputs_ManHours.Value Then
        txtInputs_EngRate.Enabled = True
        txtInputs_AccRate.Enabled = True
        txtInputs_LOARate.Enabled = True
        txtInputs_TravelRate.Enabled = True
    Else
        txtInputs_EngRate.Enabled = False
        txtInputs_AccRate.Enabled = False
        txtInputs_LOARate.Enabled = False
        txtInputs_TravelRate.Enabled = False
    End If
End Sub


Private Sub cmCurrency_Change()
    Range("Project_Currency") = cmCurrency.Value
    If cmCurrency.Value = "ZAR" Then
        txtProj_ConversionRate.Enabled = False
    Else
        txtProj_ConversionRate.Enabled = True
    End If
    
End Sub

Private Sub cmDocType_Change()
    Range("Document") = cmDocType.Value
    If cmDocType.Value = "Quotation" Then
        txtQuote_No.Enabled = True
        txtQuote_No.BackColor = RGB(255, 255, 255)
        txtProj_No.Enabled = False
        txtProj_No.BackColor = RGB(242, 242, 242)
    Else
        txtQuote_No.Enabled = False
        txtQuote_No.BackColor = RGB(242, 242, 242)
        txtProj_No.Enabled = True
        txtProj_No.BackColor = RGB(255, 255, 255)
    End If
End Sub

Private Sub cmInputs_Incoterms_Change()
    If cmInputs_Incoterms.Value = "N/A" Then
        txtInputs_IncotermsDest.Enabled = False
        txtInputs_IncotermsDest.BackColor = RGB(255, 255, 255)
        txtInputs_IncotermsDest.Text = "N/A"
        
    Else
        txtInputs_IncotermsDest.Enabled = True
        txtInputs_IncotermsDest.Text = txtClient_FinalDest.Text
        If txtInputs_IncotermsDest.Value = "" Then
            txtInputs_IncotermsDest.BackColor = RGB(255, 0, 0)
        End If
    End If
End Sub

Private Sub cmSupp_Company_Change()
    Dim ws As Worksheet
    Dim rng As Range
    Dim cell As Range
    Dim result1 As Variant
    Dim result2 As Variant
    Dim result3 As Variant
    Dim result4 As Variant
    Dim result5 As Variant
    Dim result6 As Variant
    
    Range("Supp_Company") = cmSupp_Company.Value
    
    ' Initialize result as an error value
    result1 = CVErr(xlErrNA)
    result2 = CVErr(xlErrNA)
    result3 = CVErr(xlErrNA)
    result4 = CVErr(xlErrNA)
    result5 = CVErr(xlErrNA)
    result6 = CVErr(xlErrNA)
    
    ' Define the named range
    Set ws = ThisWorkbook.Sheets("Inputs")
    Set rng = ThisWorkbook.Names("CGI_Companies_Table").RefersToRange
    
    ' Loop through each cell in the first column of the named range
    Dim I As Integer
    Dim index As Integer
    I = 0
    For Each cell In rng.Columns(1).Cells
        If cell.Value = cmSupp_Company.Value Then
            ' If a match is found, get the value from the specified column
            result1 = cell.Offset(0, 1).Value
            result2 = cell.Offset(0, 2).Value
            result3 = cell.Offset(0, 3).Value
            result4 = cell.Offset(0, 4).Value
            result5 = cell.Offset(0, 5).Value
            result6 = cell.Offset(0, 6).Value
            index = I
            Exit For
        End If
        I = I + 1
    Next cell
    
    ' Return the result
    txtSupp_RegNo = result1
    txtSupp_Vatno = result2
    txtSupp_Address = result3
    txtSupp_Tel = result4
    txtSupp_Email = result5
    txtSupp_PObox = result6

End Sub

Private Sub cmSupp_Person_Change()
    Range("Supp_Representative") = cmSupp_Person.Value
End Sub

Private Sub cmTimelineUnit_Change()
    lblTimeline1.Caption = cmTimelineUnit.Value
    lblTimeline2.Caption = cmTimelineUnit.Value
    lblTimeline3.Caption = cmTimelineUnit.Value
    lblTimeline4.Caption = cmTimelineUnit.Value
    lblTimeline5.Caption = cmTimelineUnit.Value
    lblTimeline6.Caption = cmTimelineUnit.Value
    lblTimeline7.Caption = cmTimelineUnit.Value
    lblTimeline8.Caption = cmTimelineUnit.Value
    lblTimeline9.Caption = cmTimelineUnit.Value
    lblTimeline10.Caption = cmTimelineUnit.Value
    lblTimeline11.Caption = cmTimelineUnit.Value
    lblTimeline12.Caption = cmTimelineUnit.Value
    lblTimeline13.Caption = cmTimelineUnit.Value
End Sub

Private Sub txtClient_Comp_Change()
    Range("Client_Company") = txtClient_Comp.Text
End Sub

Private Sub txtClient_Email_Change()
    Range("Client_Email") = txtClient_Email.Text
End Sub

Private Sub txtClient_EnquiryRef_Change()
    Range("Enquiry_Ref") = txtClient_EnquiryRef.Text
End Sub

Private Sub txtClient_FinalDest_Change()
    Range("Final_Destination") = txtClient_FinalDest.Text
End Sub

Private Sub txtClient_Name_Change()
    Range("Client_Name") = txtClient_Name.Text
End Sub

Private Sub txtInputs_IncotermsDest_Change()
    If txtInputs_IncotermsDest.Value = "" Then
            txtInputs_IncotermsDest.BackColor = RGB(255, 0, 0)
            Else
            txtInputs_IncotermsDest.BackColor = RGB(255, 255, 255)
    End If
End Sub

Private Sub txtPay_Perc1_Change()
    Call UpdatePaymentTotal
End Sub

Private Sub UpdatePaymentTotal()
    Dim totalPerc As Single
    Dim total As Single
    
    total = Range("Quote_Total").Value
    totalPerc = CSng(txtPay_Perc1.Value) + CSng(txtPay_Perc2.Value) + CSng(txtPay_Perc3.Value) + CSng(txtPay_Perc4.Value) + CSng(txtPay_Perc5.Value) + CSng(txtPay_Perc6.Value) + CSng(txtPay_Perc7.Value) + CSng(txtPay_Perc8.Value) + CSng(txtPay_Perc9.Value) + CSng(txtPay_Perc10.Value) + CSng(txtPay_Perc11.Value) + CSng(txtPay_Perc12.Value)
    
    If totalPerc = 100# Then
        lblTotPerc.BackColor = RGB(0, 255, 0)
    Else
        lblTotPerc.BackColor = RGB(255, 0, 0)
    End If
    
    lblPay_Amount1.Caption = "R " + Format(CSng(txtPay_Perc1.Value) * total / 100, "###,###,###.00")
    lblPay_Amount2.Caption = "R " + Format(CSng(txtPay_Perc2.Value) * total / 100, "###,###,###.00")
    lblPay_Amount3.Caption = "R " + Format(CSng(txtPay_Perc3.Value) * total / 100, "###,###,###.00")
    lblPay_Amount4.Caption = "R " + Format(CSng(txtPay_Perc4.Value) * total / 100, "###,###,###.00")
    lblPay_Amount5.Caption = "R " + Format(CSng(txtPay_Perc5.Value) * total / 100, "###,###,###.00")
    lblPay_Amount6.Caption = "R " + Format(CSng(txtPay_Perc6.Value) * total / 100, "###,###,###.00")
    lblPay_Amount7.Caption = "R " + Format(CSng(txtPay_Perc7.Value) * total / 100, "###,###,###.00")
    lblPay_Amount8.Caption = "R " + Format(CSng(txtPay_Perc8.Value) * total / 100, "###,###,###.00")
    lblPay_Amount9.Caption = "R " + Format(CSng(txtPay_Perc9.Value) * total / 100, "###,###,###.00")
    lblPay_Amount10.Caption = "R " + Format(CSng(txtPay_Perc10.Value) * total / 100, "###,###,###.00")
    lblPay_Amount11.Caption = "R " + Format(CSng(txtPay_Perc11.Value) * total / 100, "###,###,###.00")
    lblPay_Amount12.Caption = "R " + Format(CSng(txtPay_Perc12.Value) * total / 100, "###,###,###.00")
    lblPay_AmountTot.Caption = "R " + Format(totalPerc * total / 100, "###,###,###.00")
    
    lblPay_QuoteTotal.Caption = "R " + Format(total, "###,###,###.00")
       
    lblTotPerc.Caption = CStr(totalPerc) & "%"
    
End Sub

Private Sub txtPay_Perc10_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc11_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc12_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc2_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc3_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc4_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc5_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc6_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc7_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc8_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtPay_Perc9_Change()
Call UpdatePaymentTotal
End Sub

Private Sub txtProj_ConversionRate_Change()
    Range("Conversion_Rate") = txtProj_ConversionRate.Text
End Sub

Private Sub txtProj_Desc_Change()
    Range("Project_Descr") = txtProj_Desc.Text
End Sub

Private Sub txtProj_No_Change()
    Range("Project_Number") = txtProj_No.Text
    Call UpdateTitle
End Sub

Private Sub UpdateTitle()

If cmDocType = "Quotation" Then
        Input_Form.Caption = Range("Quote_Number").Text + " - Input Wizard"
    Else
        Input_Form.Caption = Range("Project_Number").Text + " - Input Wizard"
    End If
End Sub

Private Sub txtProj_Scope_Change()
    Range("Scope_Descr") = txtProj_Scope.Text
End Sub

Private Sub txtQuote_No_Change()
    Range("Quote_Number") = txtQuote_No.Text
    Call UpdateTitle
End Sub

Private Sub UserForm_Initialize()

    Call UpdateTitle
    
    cmDocType.AddItem "Quotation"
    cmDocType.AddItem "Project Tracking"
    cmDocType.AddItem "Delivery Note"
    cmDocType.AddItem "Invoicing Schedule"
    
    cmCurrency.AddItem "ZAR"
    cmCurrency.AddItem "USD"
    
    
    cmTimelineUnit.AddItem "Day(s)"
    cmTimelineUnit.AddItem "Week(s)"
    cmTimelineUnit.AddItem "Month(s)"
    
    cmTimelineUnit.Text = "Week(s)"
    
    cmInputs_PaymentType.AddItem "FDOS"
    cmInputs_PaymentType.AddItem "COD"
    
    cmInputs_PaymentType.Text = "FDOS"
    
    Call loadCurrentData
    
End Sub
