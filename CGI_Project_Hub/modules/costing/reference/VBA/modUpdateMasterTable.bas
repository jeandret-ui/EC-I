Attribute VB_Name = "modUpdateMasterTable"
Sub UpdateMaster()
    Dim wbSource, wbDest As Workbook
    Dim wsRates, wsMaster As Worksheet
    Dim loRates As ListObject
    Dim loMasterRates As ListObject
    Dim loFixedRates As ListObject
    Dim loMasterFixedRates As ListObject
    Dim loRatesFixed, loMasterRatesFixed As ListObject
    Dim sharePointURL As String
    
    ' Open Source worksheet from Sharepoint
    sharePointURL = "https://instramac.sharepoint.com/sites/CostingSheet/Shared%20Documents/General/RATES_MASTER - Copy.xlsm"
        
    ' Check if the MASTER rates link works
    On Error Resume Next
    Set wbDest = Workbooks.Open(sharePointURL)
    If Err.Number <> 0 Then
        MsgBox "The MASTER rates table sharepoint link does not work!", vbExclamation, "Link Error"
        Err.Clear
        Exit Sub
    End If
        
    Set wbSource = ThisWorkbook
        
    ' Set the source and destination worksheets
    Set wsMaster = wbDest.Sheets("RATES REFRESH")
    Set wsRates = wbSource.Sheets("RATES REFRESH")
    
    ' Set the source and destination listobjects
    Set loMasterRates = wsMaster.ListObjects("tblParts")
    Set loRates = wsRates.ListObjects("tblParts")
    
    ' Set the source and destination listobjects
    Set loMasterFixedRates = wsMaster.ListObjects("tblFixed")
    Set loFixedRates = wsRates.ListObjects("tblFixed")
    
    ' Update equipment rates table
    UpdateMasterTable loRates, loMasterRates
    
    ' Update fixed rates table
    UpdateMasterTable loFixedRates, loMasterFixedRates
    
    MsgBox "MASTER Table Updated! :)"
End Sub

Public Sub UpdateMasterTable(ByRef loRates As ListObject, ByRef loMasterRates As ListObject) 'ByVal num As Double 'ByRef xxx As xxx --> for pointers
    Dim I As Long
    For I = 1 To loRates.DataBodyRange.Rows.Count
        Dim bFound As Boolean
        Dim iCount As Long
        Dim rSourceRow As ListRow
        Dim sPartNo As String
    
        ' Check if part is found in the master rates table
        Set rSourceRow = loRates.ListRows(I)
        
        ' Get the part number
        sPartNo = rSourceRow.Range.Cells(1).Value
        
        If Not (sPartNo = "") Then
            bFound = False
            iCount = 1
            While ((Not bFound) And (iCount < loMasterRates.ListRows.Count + 1))
                Dim rDestRow As ListRow
                Set rDestRow = loMasterRates.ListRows(iCount)
        
                ' If the part is found in the master table
                If (rSourceRow.Range(1) = rDestRow.Range(1)) Then
                    bFound = True
                    
                    Dim J As Long
                    For J = 1 To rSourceRow.Range.Columns.Count
                        ' Formula cells are skipped
                        If Not (rSourceRow.Range(J).HasFormula) Then
                            Dim sSourceCellVal As Variant
                            Dim sDestCellVal As Variant
                            Dim sColumnName As String
                        
                            sSourceCellVal = rSourceRow.Range(J).Value
                            sDestCellVal = rDestRow.Range(J).Value
                            sColumnName = loMasterRates.HeaderRowRange.Cells(J).Value
                            
                            ' If there is an update from rates to master table (eg. price update)
                            If (sSourceCellVal <> sDestCellVal) Then
                                Dim Confirmation As VbMsgBoxResult
                                ' First ask for permission to update the master table
                                Confirmation = MsgBox("Do you want to update the following item's information?" & vbNewLine & sPartNo & "'s " & sColumnName & ":" & vbNewLine & sDestCellVal & vbNewLine & "-->" & vbNewLine & sSourceCellVal, vbYesNo + vbQuestion, "Confirmation")
                                If Confirmation = vbYes Then
                                    'Do the Updates
                                    loMasterRates.DataBodyRange.Cells(iCount, J).Value = sSourceCellVal
                                End If
                            End If
                        End If
                        
                    Next J
                End If
                iCount = iCount + 1
            Wend
            
            ' If a new item was added to the rates table (new part number)
            If ((iCount > loMasterRates.ListRows.Count) And (Not bFound)) Then
                ' First ask for permission to add the new item
                Confirmation = MsgBox("Do you want to add the following part number to the MASTER tables?" & vbNewLine & sPartNo, vbYesNo + vbQuestion, "Confirmation")
                If Confirmation = vbYes Then
                    ' Add the item (formulas + formatting still works)
                    Dim rNewRow As ListRow
                    Set rNewRow = loMasterRates.ListRows.Add
                    rNewRow.Range.Formula = rSourceRow.Range.Formula
                    rSourceRow.Range.Copy
                    rNewRow.Range.Cells(1).PasteSpecial Paste:=xlPasteFormats
                    Application.CutCopyMode = False
                End If
            End If
        Else
            loRates.ListRows(I).Delete
        End If
    Next I
End Sub

Public Sub UpdateRelationShipTables()

End Sub




