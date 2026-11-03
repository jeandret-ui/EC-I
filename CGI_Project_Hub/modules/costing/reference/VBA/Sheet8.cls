Attribute VB_Name = "Sheet8"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Public tMatch As Boolean
Sub openInputForm()
    Input_Form.Show
End Sub

Private Sub Worksheet_Activate()
    Me.Rows.Hidden = False
    Me.Cells(1, 1) = 1
    
    'Check Totals Match
    Call CheckTotals
End Sub

Sub ShowHide_TC_Rows()
    Dim rng As Range, cell As Range
    Dim beginRow As Long
    Dim endRow As Long
    
    beginRow = Application.WorksheetFunction.Match("Hide/Show:", Me.Columns("L"), 0)
    endRow = Application.WorksheetFunction.Match("End", Me.Columns("L"), 0)
    Set rng = Me.Range("L" & beginRow & ":" & "L" & endRow)
    If Me.Cells(1, 1) = 0 Then
        Me.Rows.Hidden = False
        Me.Cells(1, 1) = 1
    Else
        For Each cell In rng
            ' Check if the cell value is "Hide"
            If cell.Value = "Hide" Then
                ' Hide the entire row
                cell.EntireRow.Hidden = True
            End If
        Next cell
        Me.Cells(1, 1) = 0
    End If
End Sub

Sub CheckTotals()
    Dim cfPredictionsSheet As Worksheet
    Dim tcSheet As Worksheet
    Dim lastRow As Long
    Dim nonEmptyRowCount As Long
    
    Dim total1 As Double
    Dim total2 As Double
    Dim total1_row As Long
    Dim total2_row As Long
    
    ' Set references to the sheets
    Set cfPredictionsSheet = ThisWorkbook.Sheets("CF Prediction")
    Set tcSheet = ThisWorkbook.Sheets("T&C")
    
    ' Find the last row with data in column D of CF Predictions
    lastRow = cfPredictionsSheet.Cells(cfPredictionsSheet.Rows.Count, "D").End(xlUp).Row
    
    ' Initialize the count of non-empty rows
    nonEmptyRowCount = 0
        
    'check if totals match
    total1_row = Application.WorksheetFunction.Match("CF_END", tcSheet.Columns("B"), 0) - 2
    total2_row = Application.WorksheetFunction.Match("CF_END", tcSheet.Columns("B"), 0) - 2
    
    ' Determine the currency column based on the named range "Quoted_Currency"
    If ThisWorkbook.Names("Quoted_Currency").RefersToRange.Value = "ZAR" Then
        currencyColumn = "K"
        currencyColumn2 = "L"
    Else
        currencyColumn = "M"
        currencyColumn2 = "N"
    End If
  
    If tcSheet.Range("I" & total1_row) = cfPredictionsSheet.Range(currencyColumn2 & lastRow + 1).Value Then
        Range("UpdateTableMsg").Value = "Table is updated"
        Range("UpdateTableMsg").Font.Color = RGB(0, 255, 0)
        tMatch = True
    Else
        tMatch = False
        Range("UpdateTableMsg").Value = "Table is not up to date!"
        Range("UpdateTableMsg").Font.Color = RGB(255, 0, 0)
    End If

End Sub
Sub Insert_CF()
    Dim cfPredictionsSheet As Worksheet
    Dim tcSheet As Worksheet
    Dim lastRow As Long
    Dim nonEmptyRowCount As Long
    Dim I As Long
    Dim newRow As Long
    
    Dim beginRow As Long
    Dim endRow As Long
    
    ' Set references to the sheets
    Set cfPredictionsSheet = ThisWorkbook.Sheets("CF Prediction")
    Set tcSheet = ThisWorkbook.Sheets("T&C")
    
    ' Find the last row with data in column D of CF Predictions
    lastRow = cfPredictionsSheet.Cells(cfPredictionsSheet.Rows.Count, "D").End(xlUp).Row
    
    ' Initialize the count of non-empty rows
    nonEmptyRowCount = 0
    
    ' Determine the currency column based on the named range "Quoted_Currency"
    If ThisWorkbook.Names("Quoted_Currency").RefersToRange.Value = "ZAR" Then
        currencyColumn = "K"
        currencyColumn2 = "L"
    Else
        currencyColumn = "M"
        currencyColumn2 = "N"
    End If
  
        ' Count non-empty rows in column D (D6 down)
        For I = 6 To lastRow
            ' Check if the formula result is not empty
            If cfPredictionsSheet.Range("D" & I).Value <> "" Then
                ' Increment the count
                nonEmptyRowCount = nonEmptyRowCount + 1
            End If
        Next I
        
        beginRow = Application.WorksheetFunction.Match("CF_BEGIN", tcSheet.Columns("B"), 0)
        endRow = Application.WorksheetFunction.Match("CF_END", tcSheet.Columns("B"), 0)
        
        'For rowToDelete = beginRow + 1 To endRow - 2
        If beginRow + 1 < endRow - 2 Then
            tcSheet.Rows(beginRow + 1 & ":" & endRow - 2).Delete
        End If
        'Next rowToDelete
        
        endRow = Application.WorksheetFunction.Match("CF_END", tcSheet.Columns("B"), 0)
    
        ' Check if there are non-empty rows
        If nonEmptyRowCount > 0 Then
            ' Insert rows in T&C sheet
            newRow = endRow
            tcSheet.Rows(newRow & ":" & newRow + nonEmptyRowCount).Insert Shift:=xlDown
    
            ' Copy format only from row 119 in T&C to the newly inserted rows
            tcSheet.Rows(beginRow + 1).Copy
            tcSheet.Rows(newRow & ":" & newRow + nonEmptyRowCount).PasteSpecial Paste:=xlPasteFormats
            Application.CutCopyMode = False ' Clear the clipboard
        End If
    
        ' Loop through the rows in column D of CF Predictions and copy values to T&C sheet
        newRow = beginRow + 1
        For I = 6 To endRow
            If cfPredictionsSheet.Range("D" & I).Value <> "" Then
                ' Copy values from CF Predictions to T&C sheet
                tcSheet.Range("B" & newRow).Value = cfPredictionsSheet.Range("D" & I).Value
                tcSheet.Range("C" & newRow).Value = cfPredictionsSheet.Range("E" & I).Value
                tcSheet.Range("E" & newRow).Value = cfPredictionsSheet.Range("F" & I).Value
        
                
        
                tcSheet.Range("G" & newRow).Value = cfPredictionsSheet.Range(currencyColumn & I).Value
                tcSheet.Range("G" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn & I).NumberFormat
                tcSheet.Range("I" & newRow).Value = cfPredictionsSheet.Range(currencyColumn2 & I).Value
                tcSheet.Range("I" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn2 & I).NumberFormat
                
                If cfPredictionsSheet.Range("A" & I).Value = "0" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(95, 110, 125)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(255, 255, 255)  ' White
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 9  ' Set font size to 9
                    ' Make the font bold
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Bold = True
                End If
                
                If cfPredictionsSheet.Range("A" & I).Value = "1" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(0, 80, 146)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(255, 255, 255)  ' White
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 8  ' Set font size to 9
                    ' Indent column
                    tcSheet.Range("B" & newRow).IndentLevel = 1
                    tcSheet.Range("E" & newRow).IndentLevel = 1
                    tcSheet.Range("C" & newRow).IndentLevel = 1
                    tcSheet.Range("I" & newRow).IndentLevel = 1
                End If
                
                If cfPredictionsSheet.Range("A" & I).Value = "2" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(201, 231, 255)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(0, 0, 0)  ' Black
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 7  ' Set font size to 9
                    ' Indent column
                    tcSheet.Range("B" & newRow).IndentLevel = 2
                    tcSheet.Range("E" & newRow).IndentLevel = 2
                    tcSheet.Range("C" & newRow).IndentLevel = 2
                    tcSheet.Range("I" & newRow).IndentLevel = 2
                End If
            
                ' Move to the next row in T&C sheet
                newRow = newRow + 1
            End If
        Next I
        ' Paste Total
        tcSheet.Range("C" & newRow).Value = cfPredictionsSheet.Range("E" & lastRow + 1).Value
        tcSheet.Range("I" & newRow).Value = cfPredictionsSheet.Range(currencyColumn2 & lastRow + 1).Value
        tcSheet.Range("I" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn2 & lastRow + 1).NumberFormat
        tcSheet.Range("I" & newRow).EntireRow.Font.Bold = True
        tcSheet.Range("I" & newRow).Font.Size = 9  ' Set font size to 9
        Range("UpdateTableMsg").Value = "Table is updated"
        Range("UpdateTableMsg").Font.Color = RGB(0, 255, 0)
End Sub

Sub Insert_CF_Options()
    Dim cfPredictionsSheet As Worksheet
    Dim tcSheet As Worksheet
    Dim lastRow As Long
    Dim nonEmptyRowCount As Long
    Dim I As Long
    Dim newRow As Long
    
    Dim beginRow As Long
    Dim endRow As Long
    
    ' Set references to the sheets
    Set cfPredictionsSheet = ThisWorkbook.Sheets("CF Prediction (Options)")
    Set tcSheet = ThisWorkbook.Sheets("T&C")
    
    ' Find the last row with data in column D of CF Predictions
    lastRow = cfPredictionsSheet.Cells(cfPredictionsSheet.Rows.Count, "D").End(xlUp).Row
    
    ' Initialize the count of non-empty rows
    nonEmptyRowCount = 0
    
    ' Determine the currency column based on the named range "Quoted_Currency"
    If ThisWorkbook.Names("Quoted_Currency").RefersToRange.Value = "ZAR" Then
        currencyColumn = "K"
        currencyColumn2 = "L"
    Else
        currencyColumn = "M"
        currencyColumn2 = "N"
    End If
  
        ' Count non-empty rows in column D (D6 down)
        For I = 6 To lastRow
            ' Check if the formula result is not empty
            If cfPredictionsSheet.Range("D" & I).Value <> "" Then
                ' Increment the count
                nonEmptyRowCount = nonEmptyRowCount + 1
            End If
        Next I
        
        beginRow = Application.WorksheetFunction.Match("CF_BEGIN_OPT", tcSheet.Columns("B"), 0)
        endRow = Application.WorksheetFunction.Match("CF_END_OPT", tcSheet.Columns("B"), 0)
        
        'For rowToDelete = beginRow + 1 To endRow - 2
        If beginRow + 1 < endRow - 2 Then
            tcSheet.Rows(beginRow + 1 & ":" & endRow - 2).Delete
        End If
        'Next rowToDelete
        
        endRow = Application.WorksheetFunction.Match("CF_END_OPT", tcSheet.Columns("B"), 0)
    
        ' Check if there are non-empty rows
        If nonEmptyRowCount > 0 Then
            ' Insert rows in T&C sheet
            newRow = endRow
            tcSheet.Rows(newRow & ":" & newRow + nonEmptyRowCount).Insert Shift:=xlDown
    
            ' Copy format only from row 119 in T&C to the newly inserted rows
            tcSheet.Rows(beginRow + 1).Copy
            tcSheet.Rows(newRow & ":" & newRow + nonEmptyRowCount).PasteSpecial Paste:=xlPasteFormats
            Application.CutCopyMode = False ' Clear the clipboard
        End If
    
        ' Loop through the rows in column D of CF Predictions and copy values to T&C sheet
        newRow = beginRow + 1
        For I = 6 To endRow
            If cfPredictionsSheet.Range("D" & I).Value <> "" Then
                ' Copy values from CF Predictions to T&C sheet
                tcSheet.Range("B" & newRow).Value = cfPredictionsSheet.Range("D" & I).Value
                tcSheet.Range("C" & newRow).Value = cfPredictionsSheet.Range("E" & I).Value
                tcSheet.Range("E" & newRow).Value = cfPredictionsSheet.Range("F" & I).Value
        
                
        
                tcSheet.Range("G" & newRow).Value = cfPredictionsSheet.Range(currencyColumn & I).Value
                tcSheet.Range("G" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn & I).NumberFormat
                tcSheet.Range("I" & newRow).Value = cfPredictionsSheet.Range(currencyColumn2 & I).Value
                tcSheet.Range("I" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn2 & I).NumberFormat
                
                If cfPredictionsSheet.Range("A" & I).Value = "0" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(95, 110, 125)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(255, 255, 255)  ' White
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 9  ' Set font size to 9
                    ' Make the font bold
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Bold = True
                End If
                
                If cfPredictionsSheet.Range("A" & I).Value = "1" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(0, 80, 146)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(255, 255, 255)  ' White
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 8  ' Set font size to 9
                    ' Indent column
                    tcSheet.Range("B" & newRow).IndentLevel = 1
                    tcSheet.Range("E" & newRow).IndentLevel = 1
                    tcSheet.Range("C" & newRow).IndentLevel = 1
                    tcSheet.Range("I" & newRow).IndentLevel = 1
                End If
                
                If cfPredictionsSheet.Range("A" & I).Value = "2" Then
                    tcSheet.Range("B" & newRow & ":I" & newRow).Interior.Color = RGB(201, 231, 255)  ' Background 1, Darker 35
                    ' Change the font color
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Color = RGB(0, 0, 0)  ' Black
                    tcSheet.Range("B" & newRow & ":I" & newRow).Font.Size = 7  ' Set font size to 9
                    ' Indent column
                    tcSheet.Range("B" & newRow).IndentLevel = 2
                    tcSheet.Range("E" & newRow).IndentLevel = 2
                    tcSheet.Range("C" & newRow).IndentLevel = 2
                    tcSheet.Range("I" & newRow).IndentLevel = 2
                End If
            
                ' Move to the next row in T&C sheet
                tcSheet.Range("L" & newRow).Formula = tcSheet.Range("L" & beginRow).Formula
                newRow = newRow + 1
                
            End If
            
        Next I
        ' Paste Total
        'tcSheet.Range("C" & newRow).Value = cfPredictionsSheet.Range("E" & lastRow + 1).Value
        'tcSheet.Range("I" & newRow).Value = cfPredictionsSheet.Range(currencyColumn2 & lastRow + 1).Value
        'tcSheet.Range("I" & newRow).NumberFormat = cfPredictionsSheet.Range(currencyColumn2 & lastRow + 1).NumberFormat
        'tcSheet.Range("I" & newRow).EntireRow.Font.Bold = True
        'tcSheet.Range("I" & newRow).Font.Size = 9  ' Set font size to 9
        Range("UpdateTableMsg").Value = "Table is updated"
        Range("UpdateTableMsg").Font.Color = RGB(0, 255, 0)
End Sub

Sub ManHours_Button()
    Module1.GoToNamedRange ("Man_Hours")
End Sub

Sub ProjectInput_Button()
    Module1.GoToNamedRange ("Project_Number")
End Sub

Sub Timeline_Button()
    Module1.GoToNamedRange ("Est_Timeline")
End Sub

Sub Payment_Button()
    Module1.GoToNamedRange ("Payment_Perc")
End Sub

Sub Validity_Button()
    Module1.GoToNamedRange ("Quote_Validity")
End Sub

Sub Incoterms_Button()
    Module1.GoToNamedRange ("Incoterms_Add")
End Sub

Sub TaxCert_Button()
    Module1.GoToNamedRange ("Tax_Cert")
End Sub

Sub Inclusions_Button()
    Module1.GoToNamedRange ("Inclusions")
End Sub

Sub Assumptions_Button()
    Module1.GoToNamedRange ("Assumptions")
End Sub

Sub Options_Button()
    Module1.GoToNamedRange ("Options")
End Sub
