Attribute VB_Name = "Scope_Form"
Attribute VB_Base = "0{983841B0-022D-4DDB-9719-035989899DA7}{1BBFBCB6-9B01-47BF-94A9-0F42483C54BA}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = False

Private Sub Confirm_But_Click()
    Dim CBNames As Variant
    Dim selectedScope As String
    Dim ArrayLen As Long
    Dim StartRow As Long
    Dim ws As Worksheet
    Dim definedName As Name
    Dim targetRange As Range
    Dim CommaPos As Long
    
    Set ws = ThisWorkbook.Sheets("SUMMARY")
    Set definedName = ThisWorkbook.Names("Scope_Descr")
    CBNames = Array("Designs_CB", "Supply_CB", "Manuf_CB", "FAT_CB", "Pack_CB", "Del_CB", "Soft_CB", "SAT_CB", "Ins_CB", "Site_CB", "Comm_CB")
    ArrayLen = UBound(CBNames) - LBound(CBNames) + 1
    StartRow = Application.WorksheetFunction.Match("Scope_Begin", ws.Columns("L"), 0)
    Set targetRange = Range(definedName.RefersTo)
    
    For I = 0 To ArrayLen - 1
        If Me.Controls(CBNames(I)).Value = True Then
            selectedScope = selectedScope & Me.Controls(CBNames(I)).Caption & ", "
            ws.Cells(StartRow + 1 + I, targetRange.Column).Value = ChrW(&H2713)
        Else
            ws.Cells(StartRow + 1 + I, targetRange.Column).Value = "-"
        End If
    Next I

    If Len(selectedScope) > 0 Then
        selectedScope = Left(selectedScope, Len(selectedScope) - 2)
    End If
    
    CommaPos = InStrRev(selectedScope, ",")
    
    If CommaPos > 0 Then
        selectedScope = Left(selectedScope, CommaPos - 1) & " &" & Mid(selectedScope, CommaPos + 1)
    End If
    
    selectedScope = "In response to the requirements outlined by " & Range(ThisWorkbook.Names("Client_Company")).Value & " the scope of work involves providing " & selectedScope & " for " & Range(ThisWorkbook.Names("Project_Descr")).Value & " at " & Range(ThisWorkbook.Names("Final_Destination")).Value & "."
    
    targetRange.Value = selectedScope
    Input_Form.txtProj_Scope.Text = selectedScope
    
    Unload Me
End Sub

